import express from "express";
import fs from "fs";
import path from "path";
import nodemailer from "nodemailer";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: "10mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  // Safe GET probe to check whether the deployed Apps Script supports sheet writes via doGet
  app.post("/api/apps-script-capabilities", async (req, res) => {
    try {
      const DEFAULT_APPS_SCRIPT_URL =
        "https://script.google.com/macros/s/AKfycbxLs1eWLPqTQbKUSxhPfs8NdO-tO8wiDhUg40Et09Fy4bPC_onHvRjYX-Tf1bMce1i8Tw/exec";
      let targetUrl =
        (req.body?.scriptUrl && String(req.body.scriptUrl).trim()) ||
        process.env.APPS_SCRIPT_URL ||
        DEFAULT_APPS_SCRIPT_URL;
      if (targetUrl.includes("/a/macros/")) {
        targetUrl = targetUrl.replace(/\/a\/macros\/[^\/]+\//, "/");
      }

      const response = await fetch(targetUrl, {
        method: "GET",
        redirect: "follow",
      });
      const text = await response.text();
      let data: any = null;
      try {
        data = JSON.parse(text);
      } catch {
        data = null;
      }

      return res.json({
        supportsSheetsWrite: Boolean(data && data.supportsSheetsWrite === true),
      });
    } catch {
      return res.json({ supportsSheetsWrite: false });
    }
  });

  // API route for sending real emails
  app.post("/api/send-email", async (req, res) => {
    try {
      const { recipients, subject, text, html, reportCode } = req.body;

      if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
        return res.status(400).json({ success: false, message: "No recipients specified" });
      }

      // Check if SMTP environment variables are set
      const smtpHost = process.env.SMTP_HOST;
      const smtpUser = process.env.SMTP_USER;
      const smtpPass = process.env.SMTP_PASS;

      if (!smtpHost || !smtpUser || !smtpPass) {
        return res.json({
          success: false,
          mode: "mailto",
          message: "Configuración SMTP del servidor no configurada. Utilice la opción 'Abrir en Cliente de Correo' para enviar desde su cliente local (Outlook/Gmail).",
        });
      }

      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: Number(process.env.SMTP_PORT) || 587,
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || `"Mantenimiento Kikes" <${smtpUser}>`,
        to: recipients.join(", "),
        subject: subject || `[ACTA OVERHAUL] ${reportCode}`,
        text: text,
        html: html || text,
      });

      return res.json({
        success: true,
        mode: "smtp",
        messageId: info.messageId,
        message: "Correo enviado exitosamente a través del servidor SMTP.",
      });
    } catch (error: any) {
      console.error("Error sending email:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Error al enviar el correo a través del servidor",
      });
    }
  });

  // API route for triggering Google Apps Script (correoZucami / AppSheet script)
  app.post("/api/trigger-apps-script", async (req, res) => {
    try {
      const { scriptUrl, payload } = req.body;
      const DEFAULT_APPS_SCRIPT_URL =
        "https://script.google.com/macros/s/AKfycbxLs1eWLPqTQbKUSxhPfs8NdO-tO8wiDhUg40Et09Fy4bPC_onHvRjYX-Tf1bMce1i8Tw/exec";

      let targetUrl = (scriptUrl && scriptUrl.trim()) || process.env.APPS_SCRIPT_URL || DEFAULT_APPS_SCRIPT_URL;

      // Clean domain workspace URL format if present
      if (targetUrl.includes("/a/macros/")) {
        targetUrl = targetUrl.replace(/\/a\/macros\/[^\/]+\//, "/");
      }

      console.log("Invocando Google Apps Script en:", targetUrl);

      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        redirect: "follow",
        body: JSON.stringify(payload || {}),
      });

      const responseText = await response.text();
      let responseData: any = null;
      try {
        responseData = JSON.parse(responseText);
      } catch {
        responseData = null;
      }

      const isGoogleLoginRedirect =
        responseText.includes("accounts.google.com") ||
        responseText.includes("ServiceLogin") ||
        responseText.includes("<!DOCTYPE html>");

      if (isGoogleLoginRedirect) {
        return res.json({
          success: false,
          status: response.status,
          message:
            "Acceso denegado por Google. El Web App fue publicado con restricción de acceso. Debe cambiar 'Quién tiene acceso' a 'Cualquier persona' (Anyone) en la configuración de la implementación.",
        });
      }

      if (!responseData || responseData.status === "error") {
        return res.json({
          success: false,
          status: response.status,
          message: responseData?.message || "El script de Google Apps Script no devolvió una respuesta válida.",
          data: responseData,
        });
      }

      return res.json({
        success: true,
        status: response.status,
        data: responseData,
        message: responseData.message || "Google Apps Script ejecutado exitosamente.",
      });
    } catch (error: any) {
      console.error("Error al ejecutar Google Apps Script:", error);
      return res.status(500).json({
        success: false,
        error: error.message || "Error al comunicarse con Google Apps Script",
      });
    }
  });

  // Vite middleware for development; static files for production
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const cwdDist = path.join(process.cwd(), "dist");
    const distPath = fs.existsSync(path.join(cwdDist, "index.html")) ? cwdDist : __dirname;
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
