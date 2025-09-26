const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
  res.redirect("/about.html");
});

module.exports = router;
