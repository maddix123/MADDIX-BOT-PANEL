# 🤖 Maddix Portal v2

**The easiest, most complete open-source WhatsApp Bot Hosting Panel** with domain support, automatic HTTPS, a beautifully styled mobile-responsive dashboard, and powerful admin features.

![License](https://img.shields.io/badge/License-MIT-green)
![Node.js](https://img.shields.io/badge/Node.js-v20.x-blue)
![Mongoose](https://img.shields.io/badge/MongoDB-Mongoose-brightgreen)
![Socket.io](https://img.shields.io/badge/Real--time-Socket.io-blueviolet)

---

## 🚀 One-Line Installation (Recommended)

Just copy and paste this **single command** on your Ubuntu server to configure, compile, and deploy the panel with automated SSL/HTTPS configuration:

```bash
cd /tmp && rm -rf maddix-portal-v2 && git clone https://github.com/maddix123/MADDIX-BOT-PANEL.git maddix-portal-v2 && cd maddix-portal-v2 && sudo bash install.sh
```

---

## 🌟 Key Features

### 👑 Fully Loaded Admin Section (Newly Improved)
* **Live Bot Monitoring:** Monitor all active and pending bot deployments on the system. View owner accounts (username/email), pairing codes, associated phone numbers, plan durations, and precise expiration dates.
* **Direct Process Controls:** Run remote operations—**Stop**, **Restart**, and **Delete permanently**—for any user's bot instance.
* **Terminal Log Reader:** Read live console logs of any bot instance directly from a modal on the admin interface, fully formatted with severity color codes.
* **Set Bot Prices & Durations:** Dynamically update renting prices (in coins), default rental durations (in days), and active status (available to rent or not) for both bot configurations (`Maddix Bot One` & `Maddix Bot Two`).
* **Manage Users:** View registered users, perform quick-coin addition (+50, +100), edit account details (username, email, coin balance, system role), enable/disable accounts, or safely delete accounts (which terminates and cleans up all of their bot instances).
* **Create Custom Rental Packages:** Set up unique, duration-based billing plans (e.g., *VIP 7-Day Plan*, *Ultra 90-Day Package*) with custom pricing structures.

### 👥 Client-Facing Dashboard
* **Synchronized Admin Packages:** Custom packages created by the admin instantly render on the user's dashboard inside the **"Special Rental Packages"** section!
* **Interactive Deploy Modal:** When deploying a bot, users can select either the default plan or pick any of the custom rental packages created by the admin.
* **Billing System:** The system automatically charges the user the package price and schedules the bot instance with the exact package duration and expiration.
* **Real-time Synchronization:** Connection statuses, pairing codes, and event outputs sync instantly over Socket.io connections.

### 📱 Fully Mobile-Responsive
* Handcrafted with modern CSS3 using flexible flexboxes, responsive CSS grids, and viewport adjustments. Both the Client Dashboard and Admin Section scale beautifully on any smartphone, tablet, or desktop screen.

---

## 🛠️ System Stack

* **Frontend:** Clean, dependency-free HTML5, CSS3, and JavaScript (ES6) for fast page loading. Includes inline styles and media queries for mobile-friendliness.
* **Backend:** Node.js, Express.js (REST API, authentication middleware, rate limiting).
* **Database:** MongoDB & Mongoose (Users, Bot Configurations, Bot Instances, and Packages).
* **Real-time:** Socket.io (Bi-directional terminal logs, status updates, pairing code delivery).
* **Process Manager:** PM2 (Keeps backend panel and WhatsApp bots running infinitely in background, auto-restarting on errors).

---

## 📂 Project Structure

```
├── backend/
│   ├── middleware/      # Authentication & route guards (User & Admin)
│   ├── models/          # Mongoose models (User, Bot, BotInstance, Package, BotPricing)
│   ├── routes/          # API route definitions (auth, user, bot, admin, panel integrations)
│   ├── services/        # Bot spawning services, Socket.io, and Process managers
│   ├── utils/           # Database seeding (Auto-seeding admins and cleaning old bots)
│   └── server.js        # Entrypoint for Express and database connections
├── bots/
│   ├── bot-one/         # Maddix Bot One source code
│   └── bot-two/         # Maddix Bot Two source code
├── frontend/
│   ├── css/             # Stylesheet rules (responsive variables and overlays)
│   ├── js/              # Client-side scripts (auth, dashboard, admin handlers)
│   ├── index.html       # Landing / Authentication portal
│   ├── dashboard.html   # User dashboard
│   └── admin.html       # Admin control center
└── install.sh           # Interactive server setup installer
```

---

## ⚙️ Administrative Configuration

To access your admin panel, navigate to `/admin` on your deployed portal domain. 

### Default Admin Login (Change immediately after installation):
* **Email:** `admin@maddix.com`
* **Password:** `MaddixAdmin123!`

---

## 🤝 Support and Development

For feature requests, bug reporting, or code contributions, please open an issue or pull request on this repository. Created with ❤️ by **maddix123**.
