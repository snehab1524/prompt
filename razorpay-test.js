const Razorpay = require("razorpay");
require("dotenv").config();

console.log("KEY ID:", process.env.RAZORPAY_KEY_ID);
console.log("KEY SECRET LENGTH:", process.env.RAZORPAY_KEY_SECRET?.length);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

razorpay.orders.create(
  {
    amount: 49900,
    currency: "INR",
  },
  (err, order) => {
    if (err) {
      console.error("❌ RAZORPAY ERROR:");
      console.error(err);
    } else {
      console.log("✅ ORDER CREATED:");
      console.log(order);
    }
  }
);
