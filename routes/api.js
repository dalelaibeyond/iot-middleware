const express = require("express");
const logger = require("../utils/logger");

const router = express.Router();

// This route file now delegates to the RestAPIManager component
// All API endpoints are managed by the RestAPIManager

// Initialize RestAPIManager and mount its routes
router.use("/", (req, res, next) => {
  const application = req.app.get("application");
  if (!application) {
    return res.status(500).json({ error: "Application not available" });
  }

  const restAPIManager = application.getComponent("rest");
  if (!restAPIManager) {
    return res.status(500).json({ error: "REST API not available" });
  }

  // Mount the RestAPIManager router
  restAPIManager.getRouter()(req, res, next);
});

module.exports = router;
