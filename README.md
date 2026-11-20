# YAO English Teacher Hub

**Academic Coordinator plan: Month 1 and the road to Month 6**  
Private web application for YAO English teachers, run by Academic Coordinator Tr Hein Tay Za.

---

## 1. Firebase Configuration
Firebase Authentication (Google Sign-In) and Cloud Firestore are already provisioned and wired via `firebase-applet-config.json` in the project root.

If you ever move this app to a different Firebase project:
1. Replace `firebase-applet-config.json` with your new Firebase Web App config (`projectId`, `appId`, `apiKey`, `authDomain`, `firestoreDatabaseId`).
2. In Firebase Console → **Authentication → Sign-in method**:
   - Ensure **Google** is enabled.
   - *(Optional for Email Link fallback)* Enable **Email/Password** → turn on **Email link (passwordless sign-in)** and add your app domain under **Authentication → Settings → Authorized domains**.
3. Deploy the security rules in `firestore.rules` (`firebase deploy --only firestore:rules`).

---

## 2. First Admin Email (Tr Hein & Founder)
- Your coordinator email (`heintayzabusinessmail@gmail.com`) is pre-configured as the bootstrapped admin in both `src/firebase.ts` (`BOOTSTRAPPED_ADMIN_EMAIL`) and `firestore.rules` (`isBootstrappedAdmin()`).
- Sign in with Google using that email, finish the 2-minute onboarding card, and you immediately have access to **Admin Dashboard**.
- To add the Founder as a second admin: open **Admin Dashboard → Allowlist & Roles**, enter the Founder’s Google email, set Role to **Admin**, and click **Add**.

---

## 3. Adding Teachers
1. Open **Admin Dashboard → Allowlist & Roles**.
2. Enter each teacher’s email address and name, choose Role = **Teacher**, and click **Add**.
3. Share the app URL with your teachers.
   - Anyone on the allowlist signs in with Google (or Email Link) and sees the 2-minute welcome setup.
   - Anyone **not** on the allowlist sees: *"Ask Tr Hein to add your email."*

---

## 4. Editing Plan Wording & Deleting Sample Data
- **Edit any plan wording in one file:** All Coordinator bio text, 9-step job descriptions, Teacher Promises, 6-Month Roadmap text, Copy & Use templates, and Good Practice cards live in `src/content/planContent.ts`.
- **Testing with sample data:** On first login, click **Load Sample Data** on Home (or inside **Admin Dashboard**) to populate clearly labelled fictional teachers, resources, sessions, slots, observations, and FAQs.
- **Clearing sample data:** Click **Delete all sample data** in the **Admin Dashboard** header. Every document marked `isSample: true` is removed while keeping your real allowlist and teacher data safe.

---

## 5. Privacy & Security Notes
- **Zero passwords stored** (Google Sign-In + optional passwordless Email Link only).
- **Zero salary, contract, pay, phone number, referee, or student personal data** stored anywhere.
- **Private observation feedback** is enforced in `firestore.rules` so only that specific teacher, Tr Hein, and the Founder can read it.
- Please review `firestore.rules` before sharing the app broadly.

---

## 6. Deploying
- Run `npm run build` to create the production bundle in `dist/`.
- Start the production server with `npm start` (runs `server.ts`, serving `dist/` and `/api/ask-hub` on port `3000`).
- Ensure `GEMINI_API_KEY` is set in your hosting environment secrets for the grounded **Ask the Hub** assistant in the Resource Library.
