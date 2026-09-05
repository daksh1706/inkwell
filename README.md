# InkWell ✦

A calm, paper-feel notebook with an Excalidraw-style infinite canvas, PDF import/export, and complete MongoDB cloud synchronization with JWT authentication.

---

## ✨ Features

- 📓 **Hierarchical Organization**: Notebooks → Sections → Pages.
- 🎨 **Infinite Canvas**: Pen tools (Normal, Fountain, Highlighter, Marker, Pencil), shapes, arrows, sticky notes, laser pointer for presentations.
- 📑 **Notes Editor**: Rich markdown-friendly notes split-screen or full-screen.
- 📄 **PDF Import & Export**: Import PDFs as canvas backdrops and export full sections as multi-page PDFs.
- 🔐 **Authentication & Security**:
  - Sign Up & Sign In with password hashing (`bcryptjs`) and JSON Web Tokens (JWT).
  - **View/Hide password toggle** for easy verification during sign up and sign in.
- ☁️ **MongoDB Cloud Storage**:
  - Automatically syncs all notebooks, pages, canvas drawings, and notes per user.
  - Seamless offline / guest mode support with one-click cloud migration.

---

## 🚀 Running Locally

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the root directory (or edit existing):
```env
PORT=5000
MONGODB_URI=mongodb+srv://dakshmaru10_db_user:uArxncUvxgt4tSbc@cluster0.8vaqwpv.mongodb.net/inkwell?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=your_jwt_secret_key_here
NODE_ENV=development
```

### 3. Start Development Server
```bash
npm run dev
```
- Client runs on: `http://localhost:3000`
- Express API server runs on: `http://localhost:5000`

---

## 🌐 Deploying to Render (render.com)

Yes! You can easily deploy InkWell on [Render](https://render.com) as a unified fullstack Web Service.

### Step-by-Step Instructions:

1. **Push your code to GitHub**:
   Ensure your code is pushed to your GitHub repository: `https://github.com/daksh1706/inkwell`.

2. **Create a New Web Service on Render**:
   - Go to the [Render Dashboard](https://dashboard.render.com).
   - Click **New +** → **Web Service**.
   - Connect your GitHub account and select the **inkwell** repository.

3. **Configure Service Settings**:
   - **Name**: `inkwell` (or any preferred name)
   - **Language / Environment**: `Node`
   - **Branch**: `main`
   - **Region**: Choose the region closest to you (e.g., Singapore, Frankfurt, Oregon)
   - **Build Command**:
     ```bash
     npm install && npm run build
     ```
   - **Start Command**:
     ```bash
     npm start
     ```

4. **Add Environment Variables**:
   In the **Environment Variables** section on Render, add:
   - `MONGODB_URI`: `mongodb+srv://dakshmaru10_db_user:uArxncUvxgt4tSbc@cluster0.8vaqwpv.mongodb.net/inkwell?retryWrites=true&w=majority&appName=Cluster0`
   - `JWT_SECRET`: `inkwell_super_secret_jwt_key_2026_secure` (or your own random secret)
   - `NODE_ENV`: `production`

5. **Deploy**:
   - Click **Create Web Service**.
   - Render will build the Vite frontend bundle and launch the Express server, providing a live HTTPS URL (e.g. `https://inkwell.onrender.com`).

---

## 🛠️ Tech Stack

- **Frontend**: React 18, Tailwind CSS, Lucide Icons, Sonner toasts, Perfect Freehand, PDF-lib, PDF.js
- **Backend**: Node.js, Express 5, Mongoose, JWT, BcryptJS
- **Database**: MongoDB Atlas
- **Deployment**: Render / Docker / Node
