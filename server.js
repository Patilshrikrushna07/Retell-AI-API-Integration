import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import RetellClient from "retell-sdk";

dotenv.config();

const app = express();
const port = 3000;

const client = new RetellClient({
  apiKey: process.env.RETELL_API_KEY,
});

app.use(bodyParser.json());
app.use(express.static("public"));

// Serve the beautiful form
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>📞 Pru Mate Portal</title>
      <script src="https://cdn.tailwindcss.com"></script>
    </head>
    <body class="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-500 min-h-screen flex items-center justify-center">
      <div class="bg-white shadow-2xl rounded-3xl p-8 w-full max-w-md">
        <div class="text-center mb-6">
          <h1 class="text-3xl font-bold text-gray-800 mb-2">📞 Pru Mate Voice Agent</h1>
          <p class="text-gray-500 text-sm">Call any number using Retell AI</p>
        </div>
        <form id="callForm" class="space-y-5">
          <div>
            <label class="block text-gray-700 font-semibold mb-2">Full Name</label>
            <input type="text" name="name" id="name" required
              class="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="John Doe" />
          </div>
          <div>
            <label class="block text-gray-700 font-semibold mb-2">Phone Number (E.164)</label>
            <input type="text" name="phone" id="phone" required
              class="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              placeholder="+91XXXXXXXXXX" />
          </div>
          <button type="submit"
            class="w-full bg-indigo-600 text-white font-bold py-2 rounded-xl hover:bg-indigo-700 transition-all duration-300">
            🚀 Call Now
          </button>
        </form>
        <div id="responseBox" class="mt-6 text-center text-sm text-gray-700 hidden"></div>
      </div>

      <script>
        const form = document.getElementById('callForm');
        const responseBox = document.getElementById('responseBox');

        form.addEventListener('submit', async (e) => {
          e.preventDefault();
          responseBox.classList.remove('hidden');
          responseBox.innerHTML = '📞 Initiating call... please wait ⏳';
          
          const name = document.getElementById('name').value.trim();
          const phone = document.getElementById('phone').value.trim();

          const response = await fetch('/call', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, phone })
          });

          const data = await response.json();
          if (data.success) {
            responseBox.innerHTML = \`
              ✅ <b>Call initiated successfully!</b><br>
              <b>Call ID:</b> \${data.call_id}<br>
              <b>Status:</b> \${data.call_status}
            \`;
          } else {
            responseBox.innerHTML = \`
              ❌ <b>Error:</b> \${data.message || 'Unable to create call.'}
            \`;
          }
        });
      </script>
    </body>
    </html>
  `);
});

// API endpoint
app.post("/call", async (req, res) => {
  try {
    const { name, phone } = req.body;
    const formattedPhone = phone.startsWith("+") ? phone : "+" + phone;

    const response = await client.call.createPhoneCall({
      from_number: process.env.FROM_NUMBER,
      to_number: formattedPhone,
      override_agent_id: process.env.AGENT_ID,
      override_agent_version: parseInt(process.env.AGENT_VERSION),
      retell_llm_dynamic_variables: {
      name:name
  },
    });

    res.json({
      success: true,
      call_id: response.call_id,
      call_status: response.call_status,
    });
  } catch (error) {
    console.error("Error:", error);
    res.json({
      success: false,
      message: error?.error?.message || "Unknown error occurred",
    });
  }
});

app.listen(port, () =>
  console.log(`🚀 Retell Call Portal running at http://localhost:${port}`)
);
