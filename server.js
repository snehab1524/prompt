const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const path = require("path");

// Load .env only in non-production (Render injects env vars directly)
if (process.env.NODE_ENV !== "production") {
  require("dotenv").config({ path: path.join(__dirname, ".env") });
}

const usermodel = require("./model");
const userprogress = require("./userprogressmodel");
const userRegister = require("./registermodel");
const payTabledata = require("./payment_log");
const priceTable = require("./coursepricemodel");
const db = require("./test-db");
const videomodel = require("./videomodel");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

// ─── Nodemailer ────────────────────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
  tls: { rejectUnauthorized: false },
  connectionTimeout: 10000,
});

// ─── App setup ─────────────────────────────────────────────────────────────────
const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

// ─── Helpers ───────────────────────────────────────────────────────────────────
const safeParse = (value, fallback = []) => {
  try {
    if (Array.isArray(value) || (typeof value === "object" && value !== null)) return value;
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

/** Wrap a db.query (callback-style) into a Promise */
const dbQuery = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.query(sql, params, (err, result) => (err ? reject(err) : resolve(result)))
  );

// ─── DB init (sequential, safe) ────────────────────────────────────────────────
(async () => {
  try {
    await priceTable.priceTable();          // must be awaitable — see coursepricemodel fix below
  } catch (err) {
    console.error("priceTable init error:", err.message);
  }
  userRegister.createregisterTable();
  usermodel.createUserTable();
  userprogress.createuserprogress();
  videomodel.createVideoTable();

  // Migration: add purchased_domains if missing
  setTimeout(async () => {
    try {
      const cols = await dbQuery("SHOW COLUMNS FROM users LIKE 'purchased_domains'");
      if (cols.length === 0) await dbQuery("ALTER TABLE users ADD purchased_domains TEXT DEFAULT NULL");
    } catch (e) {
      console.error("Migration error:", e.message);
    }
  }, 1000);

  seedCourses();
})();

// ─── Middleware ─────────────────────────────────────────────────────────────────
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "No token" });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch (err) {
    console.error("❌ Token verification failed:", err.message);
    res.status(401).json({ error: "Invalid token" });
  }
};

const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admin access required" });
    next();
  });
};

// ─── Auth Routes ────────────────────────────────────────────────────────────────
app.post("/signup", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    const hashpassword = await bcrypt.hash(password, 15);
    const newUser = await userRegister.createNewUser({ fullName, email, password: hashpassword });
    res.status(201).json({ success: true, message: "User registered successfully ✅", data: newUser });
  } catch (err) {
    console.error("User register error:", err);
    res.status(500).json({ success: false, error: "User not registered" });
  }
});

app.post("/user-login", async (req, res) => {
  try {
    const { email, password } = req.body;

    const [authResult, purchaseResult, progressResult] = await Promise.allSettled([
      dbQuery("SELECT *, COALESCE(role, 'user') as role FROM user_register WHERE email=?", [email]),
      dbQuery("SELECT payment_verified, courseName, selected_domain, courseexpairy, duration, phone, citizen FROM users WHERE email=? ORDER BY created_at DESC LIMIT 1", [email]),
      dbQuery("SELECT * FROM user_progress WHERE email = ?", [email]),
    ]);

    if (authResult.status === "rejected") return res.status(500).json({ success: false });
    const rows = authResult.value;
    if (rows.length === 0) return res.status(401).json({ success: false, message: "User not found" });

    const user = rows[0];
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ success: false, message: "Wrong password" });

    const token = jwt.sign(
      { id: user.userid, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const purchaseRows = purchaseResult.status === "fulfilled" ? purchaseResult.value : [];
    const progressRows = progressResult.status === "fulfilled" ? progressResult.value : [];

    const purchased = purchaseRows.length > 0 && purchaseRows[0].payment_verified === "Payment Done";
    const courseData = purchaseRows[0] || null;

    let progress = { completedLevels: [], currentLevelId: "beginner", certifications: [] };
    if (progressRows.length > 0) {
      const row = progressRows[0];
      progress = {
        completedLevels: safeParse(row.completedLevels),
        currentLevelId: row.currentLevelId || "beginner",
        certifications: safeParse(row.certifications),
      };
    }

    res.json({
      success: true,
      token,
      user: { id: user.userid, fullName: user.full_name, email: user.email, role: user.role },
      purchased,
      progress,
      payment_verified: courseData?.payment_verified || "NO Payment",
      courseName: courseData?.courseName || null,
      selectedDomain: courseData?.selected_domain || null,
      courseexpairy: courseData?.courseexpairy || null,
      duration: courseData?.duration || null,
      phone: courseData?.phone || null,
      citizen: courseData?.citizen || null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

// ─── OTP ───────────────────────────────────────────────────────────────────────
const otpStore = {};

app.post("/send-otp", async (req, res) => {
  try {
    const { fullName, email, password, phone } = req.body;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return res.status(400).json({ message: "Invalid email format" });
    if (!email || !fullName || !password) return res.status(400).json({ message: "All fields required" });

    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore[email] = { otp, expires: Date.now() + 2 * 60 * 1000, userData: { fullName, email, password } };
    console.log(`🔑 OTP for ${email}: ${otp}`);

    let deliveryStatus = "stored";

    try {
      await transporter.sendMail({
        from: `"AIInsight" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Verification Code - AIInsight",
        text: `Your secure OTP is ${otp}. Do not share it.`,
        html: `<h2>Your OTP is: ${otp}</h2>`,
        headers: { "X-Priority": "1", "X-MSMail-Priority": "High", Importance: "high" },
      });
      deliveryStatus = "email";
    } catch (emailErr) {
      console.error(`❌ Email failed to ${email}: ${emailErr.message}`);
    }

    if (phone && process.env.TWILIO_SID) {
      try {
        const twilio = require("twilio");
        const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({ body: `AIINSIGHT OTP: ${otp}`, from: process.env.TWILIO_PHONE, to: phone });
        deliveryStatus = "sms";
      } catch (smsErr) {
        console.error(`❌ SMS failed to ${phone}: ${smsErr.message}`);
      }
    }

    res.json({
      message: "OTP generated successfully",
      delivery: deliveryStatus,
      ...(process.env.NODE_ENV === "development" && { otpForTest: otp }),
    });
  } catch (err) {
    console.error("Send-OTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" });

    const record = otpStore[email];
    if (!record) return res.status(400).json({ message: "No OTP found" });
    if (Date.now() > record.expires) { delete otpStore[email]; return res.status(400).json({ message: "OTP expired" }); }
    if (parseInt(record.otp) !== parseInt(otp)) return res.status(400).json({ message: "Invalid OTP" });

    const { fullName, password } = record.userData;
    const hashpassword = await bcrypt.hash(password, 15);

    const existing = await dbQuery("SELECT userid FROM user_register WHERE email = ?", [email]);
    if (existing.length > 0) {
      delete otpStore[email];
      return res.status(409).json({ message: "User already registered" });
    }

    try {
      const newUser = await userRegister.createNewUser({ fullName, email, password: hashpassword });
      delete otpStore[email];
      res.status(201).json({ success: true, message: "User registered successfully ✅", data: newUser });
    } catch (dbErr) {
      if (dbErr.code === "ER_DUP_ENTRY") { delete otpStore[email]; return res.status(409).json({ message: "Email already registered" }); }
      res.status(500).json({ message: "Registration failed" });
    }
  } catch (err) {
    console.error("Verify-OTP error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// ─── Course / Payment Routes ────────────────────────────────────────────────────
app.get("/my-course-status", verifyToken, async (req, res) => {
  try {
    const result = await dbQuery(
      "SELECT full_name, email, phone, citizen, payment_verified, courseName, selected_domain, purchased_domains, amount, duration, courseexpairy FROM users WHERE email=? ORDER BY created_at DESC LIMIT 1",
      [req.user.email]
    );
    if (!result.length) return res.json({ payment_verified: "NO Payment" });
    const userData = result[0];
    let purchasedDomains = [];
    if (userData.purchased_domains) try { purchasedDomains = JSON.parse(userData.purchased_domains); } catch {}
    res.json({ ...userData, selectedDomain: userData.selected_domain || null, purchasedDomains });
  } catch (err) {
    res.status(500).json({ error: "DB error" });
  }
});

app.get("/get-purchased-domains", verifyToken, async (req, res) => {
  try {
    const result = await dbQuery("SELECT purchased_domains FROM users WHERE email = ? ORDER BY created_at DESC LIMIT 1", [req.user.email]);
    if (!result.length || !result[0].purchased_domains) return res.json({ success: true, purchasedDomains: [] });
    try {
      res.json({ success: true, purchasedDomains: JSON.parse(result[0].purchased_domains) });
    } catch {
      res.json({ success: true, purchasedDomains: [] });
    }
  } catch {
    res.status(500).json({ success: false, error: "Database error" });
  }
});

app.get("/api/courses", async (req, res) => {
  try {
    const results = await dbQuery("SELECT course_name as name, amount, duration FROM courses ORDER BY amount ASC");
    res.json({ success: true, courses: results });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/get-course-amount", async (req, res) => {
  const { courseName } = req.body;
  if (!courseName) return res.status(400).json({ error: "Course name required" });
  try {
    const result = await dbQuery("SELECT amount, duration FROM courses WHERE course_name = ?", [courseName]);
    if (!result.length) return res.status(404).json({ error: "Course not found" });
    res.json({ amount: result[0].amount, duration: result[0].duration });
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

app.post("/register-user", async (req, res) => {
  try {
    const { fullName, email, phone, citizen, paymentVerified, courseName, selectedDomain, amount, duration, courseexpairy } = req.body;
    const newUser = await usermodel.createUser({ fullName, email, phone, citizen, paymentVerified, courseName, selectedDomain, amount, duration, courseexpairy });
    res.status(201).json({ success: true, message: "User registered successfully ✅", data: newUser });
  } catch (err) {
    console.error("User register error:", err);
    res.status(500).json({ success: false, error: "User not registered" });
  }
});

// ─── Razorpay ──────────────────────────────────────────────────────────────────
const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

app.post("/test-razorpay", async (req, res) => {
  try {
    const { courseName, domainId } = req.body;
    if (courseName === "IndividualDomain" && domainId) {
      const order = await razorpay.orders.create({ amount: 24900, currency: "INR" });
      return res.json({ orderId: order.id, amount: order.amount, key: process.env.RAZORPAY_KEY_ID });
    }
    if (!courseName) return res.status(400).json({ error: "Course name required" });
    const result = await dbQuery("SELECT amount FROM courses WHERE course_name = ?", [courseName]);
    if (!result.length) return res.status(404).json({ error: "Course not found" });
    const order = await razorpay.orders.create({ amount: Math.round(Number(result[0].amount) * 100), currency: "INR" });
    res.json({ orderId: order.id, amount: order.amount, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ error: "Order creation failed", details: err.message });
  }
});

app.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseName, selectedDomain } = req.body;
    if (!courseName) return res.status(400).json({ success: false, message: "Course name required" });

    const sig = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (sig !== razorpay_signature) return res.status(400).json({ success: false, message: "Invalid signature" });

    const courseData = await dbQuery("SELECT amount, duration FROM courses WHERE course_name = ?", [courseName]);
    if (!courseData.length) return res.status(404).json({ success: false, message: "Course not found" });

    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    if (paymentDetails.amount !== Math.round(courseData[0].amount * 100)) return res.status(400).json({ success: false, message: "Amount mismatch" });

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
    const { email } = jwt.verify(token, process.env.JWT_SECRET);

    const existing = await dbQuery("SELECT id, purchased_domains FROM users WHERE email = ? ORDER BY created_at DESC LIMIT 1", [email]);
    let purchasedDomains = [];
    if (existing.length > 0 && existing[0].purchased_domains) try { purchasedDomains = JSON.parse(existing[0].purchased_domains); } catch {}

    if (courseName === "DomainCourse" && selectedDomain && !purchasedDomains.includes(selectedDomain)) {
      purchasedDomains.push(selectedDomain);
    } else if (courseName === "FullCourse") {
      const allDomains = ["content-writing", "marketing", "coding", "data-analysis", "education", "business", "fashion", "health"];
      allDomains.forEach(d => { if (!purchasedDomains.includes(d)) purchasedDomains.push(d); });
    }

    const domainsJson = JSON.stringify(purchasedDomains);
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + courseData[0].duration);

    if (existing.length > 0) {
      await dbQuery("UPDATE users SET payment_verified='Payment Done', courseName=?, selected_domain=?, purchased_domains=?, amount=?, duration=?, courseexpairy=? WHERE email=?",
        [courseName, courseName === "DomainCourse" ? selectedDomain : null, domainsJson, courseData[0].amount, courseData[0].duration, expiryDate, email]);
    } else {
      await dbQuery("INSERT INTO users (full_name, email, payment_verified, courseName, selected_domain, purchased_domains, amount, duration, courseexpairy) VALUES (?,?,'Payment Done',?,?,?,?,?,?)",
        [email.split("@")[0], email, courseName, courseName === "DomainCourse" ? selectedDomain : null, domainsJson, courseData[0].amount, courseData[0].duration, expiryDate]);
    }

    res.json({ success: true, message: "Payment verified & course activated", course: courseName, expiry: expiryDate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/verify-domain-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, domainId } = req.body;
    if (!domainId) return res.status(400).json({ success: false, message: "Domain ID required" });

    const sig = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (sig !== razorpay_signature) return res.status(400).json({ success: false, message: "Invalid signature" });

    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    if (paymentDetails.amount !== 24900) return res.status(400).json({ success: false, message: "Amount mismatch" });

    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
    const { email } = jwt.verify(token, process.env.JWT_SECRET);

    const existing = await dbQuery("SELECT purchased_domains FROM users WHERE email = ? ORDER BY created_at DESC LIMIT 1", [email]);
    let purchasedDomains = [];
    if (existing.length > 0 && existing[0].purchased_domains) try { purchasedDomains = JSON.parse(existing[0].purchased_domains); } catch {}
    if (!purchasedDomains.includes(domainId)) purchasedDomains.push(domainId);
    const domainsJson = JSON.stringify(purchasedDomains);

    if (existing.length === 0) {
      await dbQuery("INSERT INTO users (email, purchased_domains, payment_verified) VALUES (?, ?, 'Payment Done')", [email, domainsJson]);
    } else {
      await dbQuery("UPDATE users SET purchased_domains = ? WHERE email = ?", [domainsJson, email]);
    }

    res.json({ success: true, message: "Domain payment verified successfully", data: { domainId, purchasedDomains } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Progress Routes ────────────────────────────────────────────────────────────
app.post("/save-progress", verifyToken, (req, res) => {
  const email = req.user.email;
  const incoming = {
    currentLevelId: req.body.currentLevelId,
    completedLevels: req.body.completedLevels || [],
    certifications: req.body.certifications || [],
  };

  userprogress.getProgress(email, (err, result) => {
    if (err) return res.status(500).json({ success: false, error: err.message });

    let old = { currentLevelId: null, completedLevels: [], certifications: [] };
    if (result.length > 0) {
      const row = result[0];
      old = { currentLevelId: row.currentLevelId, completedLevels: safeParse(row.completedLevels || "[]"), certifications: safeParse(row.certifications || "[]") };
    }

    const mergedLevels = Array.from(new Set([...old.completedLevels, ...incoming.completedLevels]));
    const certMap = {};
    [...(old.certifications || []), ...(incoming.certifications || [])].forEach(c => { if (c?.id) certMap[c.id] = c; });
    const mergedCerts = Object.values(certMap);

    userprogress.saveProgress(email, {
      currentLevelId: incoming.currentLevelId || old.currentLevelId,
      completedLevels: mergedLevels,
      certifications: mergedCerts,
      learnerName: req.body.learnerName,
    }, (saveErr) => {
      if (saveErr) return res.status(500).json({ success: false, error: saveErr.message });
      res.json({ success: true, progress: { currentLevelId: incoming.currentLevelId || old.currentLevelId, completedLevels: mergedLevels, certifications: mergedCerts } });
    });
  });
});

app.post("/get-progress", verifyToken, (req, res) => {
  userprogress.getProgress(req.user.email, (err, result) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!result.length) return res.json({ completedLevels: [], currentLevelId: null, certifications: [] });
    const data = result[0];
    res.json({ completedLevels: safeParse(data.completedLevels), currentLevelId: data.currentLevelId, certifications: safeParse(data.certifications) });
  });
});

app.get("/check-unlocks", verifyToken, (req, res) => {
  userprogress.getProgress(req.user.email, (err, rows) => {
    if (err) return res.status(500).json({ error: "DB error" });
    const completed = safeParse(rows[0]?.completedLevels, []);
    const beginnerDone = completed.includes("beginner");
    const domains = ["content-writing", "marketing", "coding", "data-analysis", "education", "business", "fashion", "health"];
    res.json({
      success: true,
      unlocks: {
        beginner: beginnerDone,
        domains: domains.reduce((acc, d) => ({ ...acc, [d]: beginnerDone }), {}),
        advanced: domains.reduce((acc, d) => ({ ...acc, ["advanced-" + d]: completed.includes(d) }), {}),
      },
    });
  });
});

// ─── Certificate Routes ─────────────────────────────────────────────────────────
app.post("/generate-certificate", verifyToken, (req, res) => {
  const { certificateId, name, course } = req.body;
  const email = req.user.email;
  if (!certificateId || !name || !course) return res.status(400).json({ error: "Missing required fields" });

  const certString = course.includes("Certificate") ? course : `${course} Certificate`;

  userprogress.getProgress(email, (err, result) => {
    if (err) return res.status(500).json({ error: "Progress fetch error" });

    let existingCerts = result.length > 0 ? safeParse(result[0].certifications || "[]") : [];
    if (existingCerts.some(c => c === certString || (typeof c === "string" && c.toLowerCase() === certString.toLowerCase()))) {
      return res.json({ success: true, message: "Certificate already exists" });
    }

    userprogress.saveProgress(email, { certifications: [...existingCerts, certString] }, (saveErr) => {
      if (saveErr) return res.status(500).json({ error: "Progress save failed" });
      res.json({ success: true, message: "Certificate saved ✅" });
    });
  });
});

app.post("/update-certificate-name", verifyToken, (req, res) => {
  const { certId, newName } = req.body;
  if (!certId || !newName) return res.status(400).json({ error: "Missing data" });

  userprogress.getProgress(req.user.email, (err, result) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!result.length) return res.status(404).json({ error: "User progress not found" });

    const updated = safeParse(result[0].certifications || "[]").map(c =>
      (c.id === certId || c.certId === certId) ? { ...c, learnerName: newName } : c
    );

    userprogress.saveProgress(req.user.email, { certifications: updated }, (saveErr) => {
      if (saveErr) return res.status(500).json({ error: "Database error" });
      res.json({ success: true, message: "Certificate updated" });
    });
  });
});

app.get("/verify", (req, res) => {
  res.json({ status: "valid", message: "Certificate verification placeholder" });
});

// ─── AI Feedback (Gemini) ───────────────────────────────────────────────────────
const { GoogleGenerativeAI } = require("@google/generative-ai");

app.post("/api/ai-feedback", verifyToken, async (req, res) => {
  try {
    const { userPrompt, task, model = "gemini-1.5-flash" } = req.body;
    if (!userPrompt || !task) return res.status(400).json({ error: "Missing required fields: userPrompt and task" });

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const aiModel = genAI.getGenerativeModel({ model });

    const result = await aiModel.generateContent({
      contents: [{ role: "user", parts: [{ text: `User is learning Prompt Engineering.\nTask: ${task}\nUser's Attempt: "${userPrompt}"\nEvaluate this prompt. Is it effective? Give 1 pro and 1 con in a friendly, encouraging way (max 50 words).` }] }],
      generationConfig: { temperature: 0.7, topK: 40, topP: 0.95, maxOutputTokens: 100 },
      systemInstruction: "You are a professional Prompt Engineering Coach. Be concise, encouraging, and educational.",
    });

    res.json({ success: true, feedback: result.response.text() });
  } catch (error) {
    console.error("Gemini API Error:", error);
    if (error.statusCode === 401) return res.status(401).json({ error: "AI service authentication failed." });
    if (error.statusCode === 429) return res.status(429).json({ error: "AI service rate limited. Please try again shortly." });
    res.status(500).json({ error: "AI feedback service temporarily unavailable." });
  }
});

// ─── Video Routes ───────────────────────────────────────────────────────────────
app.post("/store-video", verifyAdmin, async (req, res) => {
  try {
    const { title, video } = req.body;
    if (!title || !video) return res.status(400).json({ error: "Title and video URL required" });
    const newvideo = await videomodel.storeVideo({ title, video });
    res.status(201).json({ success: true, message: "Video URL stored successfully", data: newvideo });
  } catch (err) {
    res.status(500).json({ error: "Video storing failed" });
  }
});

app.get("/view-videos", async (req, res) => {
  try {
    const result = await dbQuery("SELECT * FROM videos");
    res.json(result);
  } catch {
    res.status(500).json({ error: "Database error" });
  }
});

// ─── Misc Routes ────────────────────────────────────────────────────────────────
app.get("/", (req, res) => res.send("Backend is running ✅"));
app.get("/test", (req, res) => res.json({ message: "Backend is working", timestamp: new Date().toISOString() }));
app.get("/test-razorpay", (req, res) => res.json({ ok: true }));
app.get("/admin-status", verifyToken, (req, res) => res.json({ isAdmin: req.user.role === "admin" }));

// ─── Seed courses ───────────────────────────────────────────────────────────────
async function seedCourses() {
  const courses = [
    { name: "Beginner Level Course", amount: 49, duration: 365 },
    { name: "DomainCourse", amount: 249, duration: 365 },
    { name: "FullCourse", amount: 499, duration: 365 },
  ];
  for (const course of courses) {
    try {
      const result = await dbQuery("SELECT id FROM courses WHERE course_name = ?", [course.name]);
      if (!result || result.length === 0) {
        await dbQuery("INSERT INTO courses (course_name, amount, duration) VALUES (?, ?, ?)", [course.name, course.amount, course.duration]);
      }
    } catch (err) {
      console.error("Seed error:", err.message);
    }
  }
}

// ─── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => console.log(`🔥 Backend running on port ${PORT} 🔥`));