# KaasuPay Frontend (simple HTML/CSS/JavaScript)

A responsive frontend for the KaasuPay wallet backend. No frontend build step or npm packages are required.

## Run it

1. Keep your backend running on `http://localhost:3000`.
2. Open this folder in VS Code.
3. If you have the Live Server extension, right-click `index.html` and choose **Open with Live Server**.
4. If you do not have Live Server, you can open `index.html` directly, but a local server is recommended.
5. Sign up or sign in with a user registered in your backend.

## Important API configuration

Open `app.js` and review `API_BASE` and `API_PATHS` near the top. The paths are assumptions based on the backend routes described for this project. Change a path if your Express route uses a different URL.

The UI expects:
- Login response to contain `token`, `accessToken`, or `jwt`.
- Amounts sent to the backend in **paise** (₹1 = 100 paise).
- Transaction and account list responses to be arrays or objects containing `transactions`, `bankAccounts`, `accounts`, `withdrawals`, `items`, or `data`.
- Bank-account POST body: `holderName`, `accountNumber`, `ifsc`.
- Withdrawal POST body: `bankAccountId`, `amount`.
- Add-money order response to include a Razorpay key (`keyId` or `key`) and order id (`order.id`, `orderId`, or `id`).
- Add-money verification endpoint at `/wallet/add-money/verify`. Update the request body/route if your backend uses a different verification contract.

## CORS

If the browser console reports a CORS error, configure Express CORS for your frontend origin during development. For example, install `cors`, then before mounting routes in your backend entry file:

```js
const cors = require("cors");
app.use(cors({ origin: "http://127.0.0.1:5500" }));
```

The origin must match the URL shown by Live Server. Do not enable unrestricted CORS in production without considering your deployment requirements.

## Security notes

- This is a development frontend, not a production-certified banking interface.
- The admin key is entered at runtime and is not saved in local storage, but sending a shared admin secret from a browser is not appropriate for a public production website. Use a real admin login/role system for production.
- Do not store or return full bank account numbers unnecessarily.
- Do not put `.env`, JWT secrets, Razorpay secret keys, or admin keys in frontend code.
- The browser keeps the user JWT in local storage for this simple demo. A production application should consider safer session/token storage and protections against XSS.
- Do not retry a payment blindly after checkout dismissal; check the payment status first.
