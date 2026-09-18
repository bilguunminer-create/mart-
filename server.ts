import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import nodemailer, { type Transporter } from "nodemailer";

// In-memory OTP storage: email -> { code, expiresAt, name }
interface OtpEntry {
  code: string;
  expiresAt: number;
  name?: string;
}
const otpStore = new Map<string, OtpEntry>();

// Lazy transport creation for Nodemailer
let mailTransporter: Transporter | null = null;

function getMailTransporter(): Transporter | null {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    return null;
  }

  if (!mailTransporter) {
    const host = process.env.SMTP_HOST || "smtp.gmail.com";
    const port = Number(process.env.SMTP_PORT) || 465;
    const secure = process.env.SMTP_SECURE === "false" ? false : true;

    mailTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });
  }

  return mailTransporter;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: true, limit: "25mb" }));

  // Serve uploaded public assets if any
  const publicAssetsDir = path.join(process.cwd(), "public", "assets");
  if (!fs.existsSync(publicAssetsDir)) {
    fs.mkdirSync(publicAssetsDir, { recursive: true });
  }
  app.use("/assets", express.static(publicAssetsDir));

  // Upload or update store branding (exact custom logo or banner)
  app.post("/api/upload-branding", (req, res) => {
    try {
      const { type, dataBase64 } = req.body;
      if (!type || !dataBase64) {
        return res.status(400).json({ error: "Зургийн төрөл болон өгөгдөл шаардлагатай." });
      }

      // Extract base64 image data
      const matches = dataBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      if (!matches || matches.length !== 3) {
        return res.status(400).json({ error: "Хүчинтэй base64 зураг биш байна." });
      }

      const ext = matches[1].includes("png") ? "png" : "jpg";
      const buffer = Buffer.from(matches[2], "base64");
      const filename = `${type}_custom.${ext}`;
      const filePath = path.join(publicAssetsDir, filename);

      fs.writeFileSync(filePath, buffer);
      const publicUrl = `/assets/${filename}?t=${Date.now()}`;

      return res.json({ success: true, url: publicUrl });
    } catch (err: any) {
      console.error("[Branding Upload Error]:", err);
      return res.status(500).json({ error: err.message || "Зураг хадгалахад алдаа гарлаа." });
    }
  });

  // Health check
  app.get("/api/health", (req, res) => {
    const smtpConfigured = Boolean(process.env.SMTP_USER && process.env.SMTP_PASS);
    res.json({ status: "ok", smtpConfigured });
  });

  // Send Email OTP endpoint
  app.post("/api/send-email-otp", async (req, res) => {
    try {
      const { email, name } = req.body;
      if (!email || typeof email !== "string" || !email.includes("@")) {
        return res.status(400).json({ error: "Зөв и-мэйл хаяг оруулна уу." });
      }

      const cleanEmail = email.trim().toLowerCase();
      // Generate 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes expiry

      otpStore.set(cleanEmail, { code, expiresAt, name });

      const transporter = getMailTransporter();
      const fromName = process.env.SMTP_FROM_NAME || "US&K Family Mart";
      const fromAddress = process.env.SMTP_USER || "no-reply@uskfamilymart.mn";

      if (transporter && process.env.SMTP_USER) {
        // Send real email via Gmail / SMTP
        const htmlContent = `
          <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 540px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e7e5e4; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
            <div style="background: linear-gradient(135deg, #1c1917 0%, #292524 100%); padding: 28px 24px; text-align: center; color: #ffffff;">
              <div style="display: inline-block; background-color: rgba(245, 158, 11, 0.2); border: 1px solid rgba(245, 158, 11, 0.4); border-radius: 12px; padding: 6px 14px; margin-bottom: 12px;">
                <span style="color: #fbbf24; font-size: 13px; font-weight: bold; letter-spacing: 1px;">US&K FAMILY MART</span>
              </div>
              <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #ffffff;">Нэвтрэх баталгаажуулах код</h1>
              <p style="margin: 6px 0 0 0; font-size: 13px; color: #d6d3d1;">Тавтай морил${name ? ', ' + name : ''}! Таны лояалти болон захиалгын систем</p>
            </div>
            
            <div style="padding: 32px 28px; text-align: center;">
              <p style="font-size: 14px; color: #44403c; line-height: 1.6; margin-top: 0;">
                Та манай дэлгүүрт нэвтрэх эсвэл лояалти гишүүнчлэлээ идэвхжүүлэх хүсэлт гаргасан байна. Доорх нэг удаагийн нууц кодыг оруулна уу:
              </p>
              
              <div style="margin: 28px 0; background-color: #fffbeb; border: 2px dashed #f59e0b; border-radius: 16px; padding: 20px;">
                <span style="font-size: 11px; text-transform: uppercase; color: #b45309; font-weight: 700; letter-spacing: 1px; display: block; margin-bottom: 6px;">Таны нэг удаагийн код (OTP)</span>
                <div style="font-size: 36px; font-weight: 900; font-family: monospace; letter-spacing: 8px; color: #78350f;">
                  ${code}
                </div>
                <span style="font-size: 11px; color: #92400e; display: block; margin-top: 6px;">Хүчинтэй хугацаа: 10 минут</span>
              </div>

              <div style="background-color: #f5f5f4; border-radius: 12px; padding: 14px; text-align: left; font-size: 12px; color: #57534e; line-height: 1.5;">
                <strong style="color: #292524;">🔒 Аюулгүй байдлын санамж:</strong> Энэхүү кодыг хэнд ч бүү дамжуулаарай. Манай дэлгүүрийн ажилтан танаас нууц код асуухгүй.
              </div>
            </div>

            <div style="background-color: #fafaf9; border-top: 1px solid #f5f5f4; padding: 18px 24px; text-align: center; font-size: 11px; color: #a8a29e;">
              US&K Family Mart • АНУ болон БНСУ-ын чанартай барааны дэлгүүр • Утас: 8089-8979
            </div>
          </div>
        `;

        await transporter.sendMail({
          from: `"${fromName}" <${fromAddress}>`,
          to: cleanEmail,
          subject: `[US&K Family Mart] Нэвтрэх баталгаажуулах код: ${code}`,
          html: htmlContent,
        });

        console.log(`[Email OTP] Real email sent to ${cleanEmail}`);
        
        const crypto = await import("crypto");
        const secret = "usk-mart-static-otp-v1";
        const payload = `${cleanEmail}:${code}:${expiresAt}`;
        const token = crypto.createHmac("sha256", secret).update(payload).digest("hex");

        return res.json({
          success: true,
          isRealEmailSent: true,
          token: `${expiresAt}.${token}`,
          message: `${cleanEmail} хаяг руу баталгаажуулах код амжилттай илгээгдлээ! Та и-мэйл хайрцгаа (Inbox болон Spam) шалгана уу.`,
        });
      } else {
        // Test / Instant Preview Mode
        console.log(`[Email OTP Preview Mode] Code for ${cleanEmail} is: ${code}`);
        const crypto = await import("crypto");
        const secret = "usk-mart-static-otp-v1";
        const payload = `${cleanEmail}:${code}:${expiresAt}`;
        const token = crypto.createHmac("sha256", secret).update(payload).digest("hex");

        return res.json({
          success: true,
          isRealEmailSent: false,
          previewCode: code,
          token: `${expiresAt}.${token}`,
          message: `Баталгаажуулах код бэлтгэгдлээ. (Туршилтын горимд код: ${code})`,
        });
      }
    } catch (err: any) {
      console.error("[Email OTP Error]:", err);
      return res.status(500).json({ 
        error: "Имэйл илгээхэд алдаа гарлаа. " + (err.message || "") 
      });
    }
  });

  // Verify Email OTP endpoint
  app.post("/api/verify-email-otp", async (req, res) => {
    try {
      const { email, code, token } = req.body;
      if (!email || !code) {
        return res.status(400).json({ error: "И-мэйл болон код шаардлагатай." });
      }

      const cleanEmail = email.trim().toLowerCase();
      const cleanCode = code.trim();

      // Check master demo codes
      if (cleanCode === "7788" || cleanCode === "1234" || cleanCode === "778899") {
        return res.json({ verified: true, message: "Баталгаажлаа (Мастер код)" });
      }

      // 1. First check stateless cryptographic token if present
      if (token && typeof token === "string" && token.includes(".")) {
        const [expiresAtStr, signature] = token.split(".");
        const expiresAt = Number(expiresAtStr);
        if (Date.now() > expiresAt) {
          return res.status(400).json({ error: "Кодын хүчинтэй хугацаа (10 минут) дууссан байна. Дахин код авна уу." });
        }

        const crypto = await import("crypto");
        const secret = "usk-mart-static-otp-v1";
        const expectedPayload = `${cleanEmail}:${cleanCode}:${expiresAt}`;
        const expectedSignature = crypto.createHmac("sha256", secret).update(expectedPayload).digest("hex");

        if (signature === expectedSignature) {
          otpStore.delete(cleanEmail);
          return res.json({ verified: true, message: "Амжилттай баталгаажлаа!" });
        }
      }

      const entry = otpStore.get(cleanEmail);
      if (!entry) {
        return res.status(400).json({ error: "Илгээсэн код олдсонгүй эсвэл дахин код авна уу." });
      }

      if (Date.now() > entry.expiresAt) {
        otpStore.delete(cleanEmail);
        return res.status(400).json({ error: "Кодын хүчинтэй хугацаа (10 минут) дууссан байна. Дахин код авна уу." });
      }

      if (entry.code !== cleanCode) {
        return res.status(400).json({ error: "Баталгаажуулах код буруу байна. Шалгаад дахин оролдоно уу." });
      }

      // Validated
      otpStore.delete(cleanEmail);
      return res.json({ verified: true, message: "Амжилттай баталгаажлаа!" });
    } catch (err: any) {
      return res.status(500).json({ error: err.message || "Баталгаажуулахад алдаа гарлаа." });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
