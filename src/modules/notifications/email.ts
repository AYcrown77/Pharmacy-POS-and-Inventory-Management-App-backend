import nodemailer from 'nodemailer';
import hbs from 'nodemailer-express-handlebars';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const createTransporter = () => {
  return nodemailer.createTransport({
    service: 'gmail',
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
};

export const sendEmail = async ({ to, subject, text, template, context }: any) => {
  try {
    const transporter = createTransporter();

    const viewPath = path.resolve(__dirname, '..', 'views');

    const hbsConfig = {
      viewEngine: {
        extname: '.handlebars',
        partialsDir: viewPath,
        layoutsDir: viewPath,
        defaultLayout: false,
        helpers: {},
        compilerOptions: {}
      },
      viewPath: viewPath,
      extName: '.handlebars',
    } as any;

    transporter.use('compile', hbs(hbsConfig));

    const templateName = template.replace('.handlebars', '');

    const mailOptions = {
      from: {
        name: 'Vyntra',
        address: process.env.EMAIL_USER || ''
      },
      to,
      subject,
      text,
      template: templateName,
      context
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent successfully:', info.messageId);
    return true;
  } catch (error: any) {
    return false;
  }
};