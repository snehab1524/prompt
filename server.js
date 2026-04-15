const crypto = require("crypto");
const express = require("express");
const cors = require("cors");
const Razorpay = require("razorpay");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const usermodel = require("./model")
const userprogress = require("./userprogressmodel");
const userRegister = require("./registermodel");
const payTabledata = require("./payment_log");
const priceTable = require("./coursepricemodel")
const db = require("./test-db");
const videomodel = require("./videomodel")
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

priceTable.priceTable();

const safeParse = (value, fallback = []) => {
  try {
    // If it's already an array/object, return as is
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
      return value;
    }
    // Otherwise try to parse as JSON string
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};

userRegister.createregisterTable();

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
db.query("SELECT *, COALESCE(role, 'user') as role FROM user_register WHERE email=?", [email], async (err, rows) => {
      if (err) return res.status(500).json({ success: false });
      if (rows.length === 0) return res.status(401).json({ success: false, message: "User not found" });
      const user = rows[0];
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) return res.status(401).json({ success: false, message: "Wrong password" });
const token = jwt.sign({ id: user.userid, email: user.email, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
      db.query("SELECT payment_verified, courseName, selected_domain, courseexpairy,duration,phone,citizen FROM users WHERE email=? ORDER BY created_at DESC LIMIT 1", [email], (err, purchaseRows) => {
        const purchased = purchaseRows.length > 0 && purchaseRows[0].payment_verified === "Payment Done";
        const courseData = purchaseRows[0] || null;
        db.query("SELECT * FROM user_progress WHERE email = ?", [email], (err, progressRows) => {
          let progress = { completedLevels: [], currentLevelId: "beginner", certifications: [] };
          if (progressRows && progressRows.length > 0) {
            const row = progressRows[0];
            progress = {
              completedLevels: typeof row.completedLevels === "string" ? JSON.parse(row.completedLevels) : row.completedLevels || [],
              currentLevelId: row.currentLevelId || "beginner",
              certifications: typeof row.certifications === "string" ? JSON.parse(row.certifications) : row.certifications || []
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
            citizen: courseData?.citizen || null
          });
        });
      });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

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
  verifyToken(req, res, (err) => {
    if (err) return;
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: "Admin access required" });
    }
    next();
  });
};

app.get("/my-course-status", verifyToken, (req, res) => {
  const email = req.user.email;
  db.query("SELECT full_name,email,phone,citizen, payment_verified, courseName, selected_domain, purchased_domains, amount,duration, courseexpairy FROM users WHERE email=? ORDER BY created_at DESC LIMIT 1", [email], (err, result) => {
    if (err) return res.status(500).json({ error: "DB error" });
    if (!result.length) return res.json({ payment_verified: "NO Payment" });
    const userData = result[0];
    let purchasedDomains = [];
    if (userData.purchased_domains) try { purchasedDomains = JSON.parse(userData.purchased_domains); } catch { }
    res.json({ ...userData, selectedDomain: userData.selected_domain || null, purchasedDomains });
  });
});

app.get("/get-purchased-domains", verifyToken, (req, res) => {
  const email = req.user.email;
  db.query("SELECT purchased_domains FROM users WHERE email = ? ORDER BY created_at DESC LIMIT 1", [email], (err, result) => {
    if (err) return res.status(500).json({ success: false, error: "Database error" });
    if (!result.length || !result[0].purchased_domains) return res.json({ success: true, purchasedDomains: [] });
    try {
      res.json({ success: true, purchasedDomains: JSON.parse(result[0].purchased_domains) });
    } catch {
      res.json({ success: true, purchasedDomains: [] });
    }
  });
});

userprogress.createuserprogress();

app.post("/save-progress", verifyToken, (req, res) => {
  const email = req.user.email;
  const incomingProgress = { 
    currentLevelId: req.body.currentLevelId, 
    completedLevels: req.body.completedLevels || [], 
    certifications: req.body.certifications || [] 
  };
  
  console.log("📥 Incoming progress from frontend:", JSON.stringify({
    email,
    levelId: incomingProgress.currentLevelId,
    levels: incomingProgress.completedLevels,
    certs: incomingProgress.certifications
  }, null, 2));
  
  userprogress.getProgress(email, (err, result) => {
    if (err) {
      console.error("❌ Error getting progress:", err);
      return res.status(500).json({ success: false, error: err.message });
    }
    
    let oldProgress = { currentLevelId: null, completedLevels: [], certifications: [] };
    if (result.length > 0) {
      const row = result[0];
      const oldCerts = safeParse(row.certifications || "[]");
      oldProgress = { 
        currentLevelId: row.currentLevelId, 
        completedLevels: safeParse(row.completedLevels || "[]"), 
        certifications: oldCerts
      };
      console.log("📦 Existing progress:", JSON.stringify(oldProgress, null, 2));
    }
    
    const mergedCompletedLevels = Array.from(new Set([...oldProgress.completedLevels, ...incomingProgress.completedLevels]));
    
    // Merge certifications (keep objects by id)
    const certsByid = {};
    
    // Add old certs
    (oldProgress.certifications || []).forEach(cert => {
      if (cert && cert.id) {
        certsByid[cert.id] = cert;
      }
    });
    
    // Add incoming certs (overwrite if same id)
    (incomingProgress.certifications || []).forEach(cert => {
      if (cert && cert.id) {
        certsByid[cert.id] = cert;
      }
    });
    
    const mergedCertifications = Object.values(certsByid);

    console.log("🔄 Merged result:", JSON.stringify({
      completedLevels: mergedCompletedLevels,
      certifications: mergedCertifications
    }, null, 2));

    userprogress.saveProgress(email, { 
      currentLevelId: incomingProgress.currentLevelId || oldProgress.currentLevelId, 
      completedLevels: mergedCompletedLevels, 
      certifications: mergedCertifications,
      learnerName: req.body.learnerName
    }, (err) => {
      if (err) {
        console.error("❌ Error saving progress:", err);
        return res.status(500).json({ success: false, error: err.message });
      }

      console.log("✅ Progress saved successfully for:", email);

      res.json({ 
        success: true, 
        progress: { 
          currentLevelId: incomingProgress.currentLevelId || oldProgress.currentLevelId, 
          completedLevels: mergedCompletedLevels, 
          certifications: mergedCertifications 
        } 
      });
    });
  });
});

app.post("/get-progress", verifyToken, (req, res) => {
  const email = req.user.email;
  userprogress.getProgress(email, (err, result) => {
    if (err) {
      console.error("Error getting progress:", err);
      return res.status(500).json({error: 'DB error'});
    }
    if (!result.length) {
      return res.json({ completedLevels: [], currentLevelId: null, certifications: [] });
    }
    const data = result[0];
    const parsedCompletedLevels = safeParse(data.completedLevels);
    let parsedCertifications = safeParse(data.certifications);
    
    const response = { completedLevels: parsedCompletedLevels, currentLevelId: data.currentLevelId, certifications: parsedCertifications };
    res.json(response);
  });
});

// NEW: Secure Gemini AI Feedback Proxy (Fixes client-side API key exposure)
const { GoogleGenerativeAI } = require("@google/generative-ai");

app.post("/api/ai-feedback", verifyToken, async (req, res) => {
  try {
    const { userPrompt, task, model = 'gemini-1.5-flash' } = req.body;
    
    if (!userPrompt || !task) {
      return res.status(400).json({ 
        error: 'Missing required fields: userPrompt and task' 
      });
    }

    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const aiModel = genAI.getGenerativeModel({ model });

    const fullPrompt = `User is learning Prompt Engineering. 
Task: ${task}
User's Attempt: "${userPrompt}"
Evaluate this prompt. Is it effective? Give 1 pro and 1 con in a friendly, encouraging way (max 50 words).`;

    const result = await aiModel.generateContent({
      contents: [{ 
        role: 'user', 
        parts: [{ text: fullPrompt }] 
      }],
      generationConfig: {
        temperature: 0.7,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 100,
      },
      systemInstruction: "You are a professional Prompt Engineering Coach. Be concise, encouraging, and educational."
    });

    const feedback = result.response.text();

    res.json({ 
      success: true, 
      feedback: feedback 
    });

  } catch (error) {
    console.error("Gemini API Error:", error);
    
    if (error.statusCode === 401) {
      return res.status(401).json({ 
        error: 'AI service authentication failed. Please contact support.' 
      });
    }
    
    if (error.statusCode === 429) {
      return res.status(429).json({ 
        error: 'AI service rate limited. Please try again shortly.' 
      });
    }

    res.status(500).json({ 
      error: 'AI feedback service temporarily unavailable. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

app.get("/test", (req, res) => {
  res.json({ message: "Backend is working", timestamp: new Date().toISOString() });
});

app.get("/check-unlocks", verifyToken, (req, res) => {
  const email = req.user.email;
  userprogress.getProgress(email, (err, rows) => {
    if (err) return res.status(500).json({error: 'DB error'});
    const completed = safeParse(rows[0]?.completedLevels, []);
    const beginnerDone = completed.includes('beginner');
    const domains = ['content-writing', 'marketing', 'coding', 'data-analysis', 'education', 'business', 'fashion', 'health'];
    const domainsDone = domains.reduce((acc, d) => ({ ...acc, [d]: beginnerDone }), {});
    const advancedAccessible = domains.reduce((acc, d) => ({ ...acc, ['advanced-' + d]: completed.includes(d) }), {});
    res.json({success: true, unlocks: { beginner: beginnerDone, domains: domainsDone, advanced: advancedAccessible }});
  });
});




const otpStore = {};
// Nodemailer fixed: createTransporter + error handling (email fail != OTP fail)

// const transporter = nodemailer.createTransporter({
//   service: "gmail",
//   auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
// });

app.post("/send-otp", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;
    if (!email || !fullName || !password) return res.status(400).json({ message: "All fields required" });
    const otp = Math.floor(100000 + Math.random() * 900000);
    otpStore[email] = { otp, expires: Date.now() + 2 * 60 * 1000, userData: { fullName, email, password } };
    
    // Send email OTP (non-blocking for demo)
    try {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: "Email Verification OTP",
        text: `Your OTP is ${otp}. It is valid for 2 minutes.`
      });
      console.log(`OTP email sent to ${email}`);
    } catch (emailErr) {
      console.error(`Failed to send OTP email to ${email}:`, emailErr.message);
      // Still proceed - OTP in memory for verify
    }
    
    res.json({ message: "OTP sent successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to send OTP" });
  }
});

app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;
    const record = otpStore[email];
    if (!record) return res.status(400).json({ message: "No OTP found" });
    if (Date.now() > record.expires) {
      delete otpStore[email];
      return res.status(400).json({ message: "OTP expired" });
    }
    if (record.otp != otp) return res.status(400).json({ message: "Invalid OTP" });
    const { fullName, password } = record.userData;
    const hashpassword = await bcrypt.hash(password, 15);
    const newUser = await userRegister.createNewUser({ fullName, email, password: hashpassword });
    delete otpStore[email];
    res.status(201).json({ success: true, message: "User registered successfully ✅", data: newUser });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Registration failed" });
  }
});

videomodel.createVideoTable();

app.get("/admin-status", verifyToken, (req, res) => {
  res.json({ isAdmin: req.user.role === 'admin' });
});

app.post("/store-video", verifyAdmin, async (req, res) => {
  try {
    const { title, video } = req.body;
    if (!title || !video) return res.status(400).json({ error: "Title and video URL required" });
    const newvideo = await videomodel.storeVideo({ title, video });
    res.status(201).json({ success: true, message: "Video URL stored successfully", data: newvideo });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Video storing failed" });
  }
});

app.get("/view-videos", (req, res) => {
  db.query("SELECT * FROM videos", (err, result) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json(result);
  });
});

usermodel.createUserTable();

const runDatabaseMigration = () => {
  db.query("SHOW COLUMNS FROM users LIKE 'purchased_domains'", (err, result) => {
    if (result.length === 0) {
      db.query("ALTER TABLE users ADD purchased_domains TEXT DEFAULT NULL");
    }
  });
};
setTimeout(runDatabaseMigration, 1000);

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

const razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });

app.get("/", (req, res) => res.send("Backend is running ✅"));
app.get("/test-razorpay", (req, res) => res.json({ ok: true }));

app.get("/api/courses", (req, res) => {
  db.query("SELECT course_name as name, amount, duration FROM courses ORDER BY amount ASC", (err, results) => {
    if (err) return res.status(500).json({ error: "Database error" });
    res.json({ success: true, courses: results });
  });
});

app.post("/get-course-amount", (req, res) => {
  const { courseName } = req.body;
  if (!courseName) return res.status(400).json({ error: "Course name required" });
  db.query("SELECT amount,duration FROM courses WHERE course_name = ?", [courseName], (err, result) => {
    if (err) return res.status(500).json({ error: "Database error" });
    if (!result.length) return res.status(404).json({ error: "Course not found" });
    res.json({ amount: result[0].amount, duration: result[0].duration });
  });
});

app.post("/test-razorpay", async (req, res) => {
  try {
    const { courseName, domainId } = req.body;
    if (courseName === "IndividualDomain" && domainId) {
      const order = await razorpay.orders.create({ amount: 24900, currency: "INR" });
      return res.json({ orderId: order.id, amount: order.amount, key: process.env.RAZORPAY_KEY_ID });
    }
    if (!courseName) return res.status(400).json({ error: "Course name required" });
    const amountResult = await new Promise((resolve, reject) => db.query("SELECT amount FROM courses WHERE course_name = ?", [courseName], (err, result) => err || !result.length ? reject(err || "Course not found") : resolve(result[0].amount)));
    const amountInPaise = Math.round(Number(amountResult) * 100);
    const order = await razorpay.orders.create({ amount: amountInPaise, currency: "INR" });
    res.json({ orderId: order.id, amount: order.amount, key: process.env.RAZORPAY_KEY_ID });
  } catch (err) {
    res.status(500).json({ error: "Order creation failed", details: err.message });
  }
});

app.post("/verify-domain-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, domainId } = req.body;
    if (!domainId) return res.status(400).json({ success: false, message: "Domain ID required" });
    const generated_signature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (generated_signature !== razorpay_signature) return res.status(400).json({ success: false, message: "Invalid signature" });
    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    if (paymentDetails.amount !== 24900) return res.status(400).json({ success: false, message: "Amount mismatch" });
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;
    const existingDomains = await new Promise((resolve, reject) => db.query("SELECT purchased_domains FROM users WHERE email = ? ORDER BY created_at DESC LIMIT 1", [email], (err, result) => err ? reject(err) : resolve(result)));
    let purchasedDomains = [];
    if (existingDomains.length > 0 && existingDomains[0].purchased_domains) try { purchasedDomains = JSON.parse(existingDomains[0].purchased_domains); } catch { }
    if (!purchasedDomains.includes(domainId)) purchasedDomains.push(domainId);
    const domainsJson = JSON.stringify(purchasedDomains);
    if (existingDomains.length === 0) db.query("INSERT INTO users (email, purchased_domains, payment_verified) VALUES (?, ?, 'Payment Done')", [email, domainsJson]);
    else db.query("UPDATE users SET purchased_domains = ? WHERE email = ?", [domainsJson, email]);
    res.json({ success: true, message: "Domain payment verified successfully", data: { domainId, purchasedDomains } });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/verify-payment", async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, courseName, selectedDomain } = req.body;
    if (!courseName) return res.status(400).json({ success: false, message: "Course name required" });
    const generated_signature = crypto.createHmac("sha256", process.env.RAZORPAY_KEY_SECRET).update(`${razorpay_order_id}|${razorpay_payment_id}`).digest("hex");
    if (generated_signature !== razorpay_signature) return res.status(400).json({ success: false, message: "Invalid signature" });
    const courseData = await new Promise((resolve, reject) => db.query("SELECT amount, duration FROM courses WHERE course_name = ?", [courseName], (err, result) => err || !result.length ? reject(err || "Course not found") : resolve(result[0])));
    const expectedAmount = Math.round(courseData.amount * 100);
    const paymentDetails = await razorpay.payments.fetch(razorpay_payment_id);
    if (paymentDetails.amount !== expectedAmount) return res.status(400).json({ success: false, message: "Amount mismatch" });
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "Authentication required" });
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const email = decoded.email;
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + courseData.duration);
    const existing = await new Promise((resolve, reject) => db.query("SELECT id, purchased_domains FROM users WHERE email = ? ORDER BY created_at DESC LIMIT 1", [email], (err, result) => err ? reject(err) : resolve(result)));
    let purchasedDomains = [];
    if (existing.length > 0 && existing[0].purchased_domains) try { purchasedDomains = JSON.parse(existing[0].purchased_domains); } catch { }
    
    // Handle domain/full course purchases
    if (courseName === "DomainCourse" && selectedDomain && !purchasedDomains.includes(selectedDomain)) {
      purchasedDomains.push(selectedDomain);
    } else if (courseName === "FullCourse") {
      // Unlock all 8 domains for FullCourse purchase
      const allDomains = ['content-writing', 'marketing', 'coding', 'data-analysis', 'education', 'business', 'fashion', 'health'];
      allDomains.forEach(domain => {
        if (!purchasedDomains.includes(domain)) {
          purchasedDomains.push(domain);
        }
      });
    }
    
    const domainsJson = JSON.stringify(purchasedDomains);
    if (existing.length > 0) {
      db.query("UPDATE users SET payment_verified = 'Payment Done', courseName = ?, selected_domain = ?, purchased_domains = ?, amount = ?, duration = ?, courseexpairy = ? WHERE email = ?", [courseName, courseName === "DomainCourse" ? selectedDomain : null, domainsJson, courseData.amount, courseData.duration, expiryDate, email]);
    } else {
      db.query("INSERT INTO users (full_name, email, payment_verified, courseName, selected_domain, purchased_domains, amount, duration, courseexpairy) VALUES (?, ?, 'Payment Done', ?, ?, ?, ?, ?, ?)", [email.split('@')[0], email, courseName, courseName === "DomainCourse" ? selectedDomain : null, domainsJson, courseData.amount, courseData.duration, expiryDate]);
    }
    res.json({ success: true, message: "Payment verified & course activated", course: courseName, expiry: expiryDate });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post("/generate-certificate", verifyToken, (req, res) => {
  const { certificateId, name, course } = req.body;
  const email = req.user.email;
  
  if (!certificateId || !name || !course) {
    return res.status(400).json({ error: "Missing required fields" });
  }
  
  const certString = course.includes('Certificate') ? course : `${course} Certificate`;

  // Get existing progress and add certificate to it
  userprogress.getProgress(email, (err, result) => {
    if (err) {
      console.error("Error getting progress:", err);
      return res.status(500).json({ error: "Progress fetch error" });
    }
    
    let existingCerts = [];
    if (result.length > 0) {
      existingCerts = safeParse(result[0].certifications || "[]");
    }
    
    // Check if certificate already exists to avoid duplicates
    const certExists = existingCerts.some(cert => cert === certString || (typeof cert === 'string' && cert.toLowerCase() === certString.toLowerCase()));
    if (certExists) {
      return res.json({ success: true, message: "Certificate already exists" });
    }
    
    const updatedCerts = [...existingCerts, certString];

    userprogress.saveProgress(email, { certifications: updatedCerts }, (saveErr) => {
      if (saveErr) {
        console.error("Progress save error:", saveErr);
        return res.status(500).json({ error: "Progress save failed" });
      }

      res.json({ success: true, message: "Certificate saved and added to progress ✅" });
    });
  });
});

app.get("/verify", (req, res) => {
  const certId = req.query.certId;
  
  // For now, just return valid - actual verification can check user_progress table
  // This is a simple verification endpoint
  res.json({ status: "valid", message: "Certificate verification placeholder" });
});

app.post("/update-certificate-name", verifyToken, (req, res) => {
  const { certId, newName } = req.body;
  const email = req.user.email;
  
  if (!certId || !newName) {
    return res.status(400).json({ error: "Missing data" });
  }
  
  // Get user progress and update certificate learnerName
  userprogress.getProgress(email, (err, result) => {
    if (err) {
      console.error("Error getting progress:", err);
      return res.status(500).json({ error: "Database error" });
    }
    
    if (result.length === 0) {
      return res.status(404).json({ error: "User progress not found" });
    }
    
    const certs = safeParse(result[0].certifications || "[]");
    const updated = certs.map((cert) => {
      if (cert.id === certId || cert.certId === certId) {
        return { ...cert, learnerName: newName };
      }
      return cert;
    });
    
    userprogress.saveProgress(email, { certifications: updated }, (saveErr) => {
      if (saveErr) {
        console.error("Update error:", saveErr);
        return res.status(500).json({ error: "Database error" });
      }
      res.json({ success: true, message: "Certificate updated" });
    });
  });
});

const seedCourses = () => {
  const courses = [
    { name: "Beginner Level Course", amount: 49, duration: 365 },
    { name: "DomainCourse", amount: 249, duration: 365 },
    { name: "FullCourse", amount: 499, duration: 365 }
  ];
  courses.forEach(course => {
    db.query("SELECT id FROM courses WHERE course_name = ?", [course.name], (err, result) => {
      if (err) {
        console.error('Error checking course:', err);
        return;
      }
      if (!result || result.length === 0) {
        db.query("INSERT INTO courses (course_name, amount, duration) VALUES (?, ?, ?)", [course.name, course.amount, course.duration]);
      }
    });
  });
};
seedCourses();

app.listen(7000, () => console.log("🔥 Backend running on port 7000 🔥"));

