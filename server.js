import express from "express";
import bodyParser from "body-parser";
import dotenv from "dotenv";
import RetellClient from "retell-sdk";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

const client = new RetellClient({
  apiKey: process.env.RETELL_API_KEY,
});

app.use(bodyParser.json());
app.use(express.static("public"));

/**
 * Agent mapping
 * Keys correspond to select option values from the client
 * Replace these strings if you have different agent ids
 */
const AGENTS = {
  compareCoverage: "agent_b59ef1b023288df02d47c215f0",
  chooseYourPlan: "agent_29efd07600ffde2960c52d6a02",
  completePayment: "agent_af49ca02889c8c7de9faa1f823",
  completeOnboarding: "agent_e51abee9f7bd9fccd7b35ba903",
};

/**
 * Optional per-agent version map:
 * - You can set env vars like AGENT_VERSION_compareCoverage=2
 * - If not provided, the code will use process.env.AGENT_VERSION (global) if present
 */
function getAgentVersionForKey(key) {
  const envKey = `AGENT_VERSION_${key}`; // e.g. AGENT_VERSION_compareCoverage
  if (process.env[envKey]) {
    const v = parseInt(process.env[envKey], 10);
    return Number.isFinite(v) ? v : undefined;
  }
  if (process.env.AGENT_VERSION) {
    const v = parseInt(process.env.AGENT_VERSION, 10);
    return Number.isFinite(v) ? v : undefined;
  }
  return undefined;
}

// Serve the beautiful form (with dropdown)
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

          <div>
            <label class="block text-gray-700 font-semibold mb-2">Test Category</label>
            <select id="agentKey" name="agentKey" required
              class="w-full border border-gray-300 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 focus:outline-none">
              <option value="compareCoverage">Compare Coverage</option>
              <option value="chooseYourPlan">Choose Your Plan</option>
              <option value="completePayment">Complete Payment</option>
              <option value="completeOnboarding">Complete Onboarding</option>
            </select>
            <p class="text-xs text-gray-500 mt-1">Select which agent to test — the server will route the call to that agent id.</p>
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
          const agentKey = document.getElementById('agentKey').value;

          // basic client-side phone normalization: ensure starts with +
          const normalizedPhone = phone.startsWith('+') ? phone : '+' + phone;

          try {
            const response = await fetch('/call', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ name, phone: normalizedPhone, agentKey })
            });

            const data = await response.json();
            if (data.success) {
              responseBox.innerHTML = \`
                ✅ <b>Call initiated successfully!</b><br>
                <b>Call ID:</b> \${data.call_id}<br>
                <b>Status:</b> \${data.call_status}<br>
                <b>Agent:</b> \${data.agent_id || 'default'}
              \`;
            } else {
              responseBox.innerHTML = \`
                ❌ <b>Error:</b> \${data.message || 'Unable to create call.'}
              \`;
            }
          } catch (err) {
            responseBox.innerHTML = '❌ <b>Error:</b> ' + (err.message || 'Unknown error');
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
    const { name, phone, agentKey } = req.body;

    if (!name || !phone) {
      return res.json({ success: false, message: "Missing name or phone" });
    }

    const formattedPhone = phone.startsWith("+") ? phone : "+" + phone;

    // pick agent id from map; fallback to global env AGENT_ID if not found
    const selectedAgentId = AGENTS[agentKey] || process.env.AGENT_ID;
    const selectedAgentVersion = getAgentVersionForKey(agentKey);

    // build call payload
    const callPayload = {
      from_number: process.env.FROM_NUMBER,
      to_number: formattedPhone,
      retell_llm_dynamic_variables: {
        name: name
      }
    };

    if (selectedAgentId) {
      callPayload.override_agent_id = selectedAgentId;
    }
    // only include version if it's defined and a number
    if (typeof selectedAgentVersion === "number") {
      callPayload.override_agent_version = selectedAgentVersion;
    }

    const response = await client.call.createPhoneCall(callPayload);

    res.json({
      success: true,
      call_id: response.call_id,
      call_status: response.call_status,
      agent_id: selectedAgentId,
      agent_version: selectedAgentVersion,
    });
  } catch (error) {
    console.error("Error:", error);
    res.json({
      success: false,
      message: error?.error?.message || error.message || "Unknown error occurred",
    });
  }
});

app.listen(port, () =>
  console.log(`🚀 Retell Call Portal running at http://localhost:${port}`)
);
