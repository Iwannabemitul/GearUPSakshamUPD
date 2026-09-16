/**
 * Saksham AI Service — socket.io mini-service on port 3003.
 *
 * Responsibilities:
 *   1. Receive `ai_respond` events with `{ text, lang, email }`.
 *   2. Look up a matching QA pair in the requested language (mock DB).
 *   3. If no match, optionally call an LLM (OpenAI/OpenRouter) — see the
 *      LLM_ENABLED flag below. The LLM is given a system prompt instructing
 *      it to reply in the user's selected language.
 *   4. If neither produces an answer, fall back to a per-language canned
 *      response.
 *
 * The whole service is single-file on purpose — it's small enough that
 * splitting it into modules would add overhead without clarity.
 */

import { createServer, type IncomingMessage, type ServerResponse } from "http";
import { Server } from "socket.io";
import { availableProviders, chatComplete } from "./llm";

const PORT = 3003;
// Separate plain-HTTP port for server-to-server JSON calls from the Next.js
// app (profile-summary generation). Kept off the socket.io port so we don't
// have to fight engine.io for request routing on "/".
const HTTP_PORT = Number(process.env.AI_HTTP_PORT || 3005);

// --- Mock QA database (mirrors src/lib/ai-widget.tsx) ----------------------

type Qa = { q: string; a: string };

const QA_BY_LANG: Record<string, Qa[]> = {
  en: [
    {
      q: "Why do I need SQL?",
      a: "Your role (Statistical Officer) requires you to analyse government datasets. That activity needs SQL at an Advanced level (4/5); your current evidence shows Intermediate (2/5), a gap of 2 levels, the largest gap in your profile. Closing it reduces time spent on manual data handling.",
    },
    {
      q: "What should I learn next?",
      a: "Based on gap size and role relevance, your top priority is SQL, followed by Data Quality Frameworks. You're already in Phase 2 of your SQL learning path — 'Advanced SQL for Government Data'.",
    },
    {
      q: "Which competency is my biggest gap?",
      a: "SQL and Data Quality Frameworks are tied as your largest gaps, each 2 levels below the required level for your role.",
    },
    {
      q: "How can I improve my Data Quality competency?",
      a: "The Data Quality & Validation Frameworks course (NSSTA, 3 days) is recommended. It's Phase 3 of your personalized learning path, and a Data Quality Assessment is available once you're ready to demonstrate the improvement.",
    },
  ],
  hi: [
    {
      q: "मुझे SQL की आवश्यकता क्यों है?",
      a: "आपकी भूमिका (सांख्यिकी अधिकारी) के लिए सरकारी डेटासेट का विश्लेषण करना आवश्यक है। इसके लिए SQL उन्नत स्तर (4/5) पर चाहिए; आपका वर्तमान स्तर मध्यवर्ती (2/5) है — 2 स्तर का अंतर, आपकी प्रोफ़ाइल का सबसे बड़ा अंतर। इसे पूरा करने से मैन्युअल डेटा हैंडलिंग में लगने वाला समय कम होगा।",
    },
    {
      q: "मुझे आगे क्या सीखना चाहिए?",
      a: "अंतर के आकार और भूमिका की प्रासंगिकता के आधार पर, आपकी सर्वोच्च प्राथमिकता SQL है, उसके बाद डेटा गुणवत्ता फ्रेमवर्क। आप पहले से ही अपने SQL लर्निंग पाथ के चरण 2 में हैं।",
    },
    {
      q: "मेरा सबसे बड़ा कौशल अंतर कौन सा है?",
      a: "SQL और डेटा गुणवत्ता फ्रेमवर्क आपके सबसे बड़े अंतर हैं — दोनों आपकी भूमिका के लिए आवश्यक स्तर से 2 स्तर नीचे हैं।",
    },
    {
      q: "मैं अपनी डेटा गुणवत्ता दक्षता कैसे सुधार सकता हूँ?",
      a: "'डेटा क्वालिटी एंड वैलिडेशन फ्रेमवर्क्स' कोर्स (NSSTA, 3 दिन) अनुशंसित है। यह आपके व्यक्तिगत लर्निंग पाथ का चरण 3 है।",
    },
  ],
  ta: [
    {
      q: "எனக்கு SQL ஏன் தேவை?",
      a: "உங்கள் பங்கு (புள்ளியியல் அதிகாரி) அரசு தரவுத்தொகுப்புகளை பகுப்பாய்வு செய்ய வேண்டும். அதற்கு SQL மேம்பட்ட நிலை (4/5) தேவை; உங்கள் தற்போதைய நிலை இடைநிலை (2/5) — 2 நிலை இடைவெளி.",
    },
    {
      q: "நான் அடுத்ததாக என்ன கற்க வேண்டும்?",
      a: "இடைவெளி அளவு மற்றும் பங்கு தொடர்பின் அடிப்படையில், உங்கள் முக்கிய முன்னுரிமை SQL, அதற்கடுத்தது தரவு தர கட்டமைப்புகள்.",
    },
    {
      q: "எனது மிகப்பெரிய திறன் இடைவெளி எது?",
      a: "SQL மற்றும் தரவு தர கட்டமைப்புகள் உங்கள் மிகப்பெரிய இடைவெளிகள் — இரண்டும் உங்கள் பங்குக்கு தேவையான நிலையை விட 2 நிலைகள் குறைவாக உள்ளன.",
    },
    {
      q: "எனது தரவு தர திறனை எப்படி மேம்படுத்துவது?",
      a: "'தரவு தரம் மற்றும் சரிபார்ப்பு கட்டமைப்புகள்' பாடநெறி (NSSTA, 3 நாட்கள்) பரிந்துரைக்கப்படுகிறது.",
    },
  ],
  te: [
    {
      q: "నాకు SQL ఎందుకు అవసరం?",
      a: "మీ పాత్ర (గణాంక అధికారి) ప్రభుత్వ డేటాసెట్‌లను విశ్లేషించాలి. అందుకే SQL అధునాతన స్థాయి (4/5) కావాలి; మీ ప్రస్తుత స్థాయి మధ్యస్థం (2/5).",
    },
    {
      q: "నేను తదుపరిది ఏమి నేర్చుకోవాలి?",
      a: "అంతర పరిమాణం మరియు పాత్ర సంబంధం ఆధారంగా, మీ అగ్ర ప్రాధాన్యత SQL.",
    },
    {
      q: "నా అతిపెద్ద నైపుణ్య అంతరం ఏది?",
      a: "SQL మరియు డేటా క్వాలిటీ ఫ్రేమ్‌వర్క్‌లు మీ అతిపెద్ద అంతరాలు.",
    },
    {
      q: "నా డేటా క్వాలిటీ సామర్థ్యాన్ని ఎలా మెరుగుపరచాలి?",
      a: "'డేటా క్వాలిటీ అండ్ వాలిడేషన్ ఫ్రేమ్‌వర్క్స్' కోర్సు (NSSTA, 3 రోజులు) సిఫార్సు చేయబడింది.",
    },
  ],
  bn: [
    {
      q: "আমার SQL কেন দরকার?",
      a: "আপনার ভূমিকা (পরিসংখ্যান অফিসার) সরকারি ডেটাসেট বিশ্লেষণ করতে হবে। এর জন্য SQL অ্যাডভান্সড স্তরে (4/5) দরকার।",
    },
    {
      q: "আমি পরবর্তী কী শিখব?",
      a: "ব্যবধানের আকার অনুযায়ী আপনার শীর্ষ অগ্রাধিকার SQL।",
    },
    {
      q: "আমার সবচেয়ে বড় দক্ষতা শূন্যতা কোনটি?",
      a: "SQL এবং ডেটা কোয়ালিটি ফ্রেমওয়ার্ক আপনার সবচেয়ে বড় শূন্যতা।",
    },
    {
      q: "আমি কীভাবে আমার ডেটা কোয়ালিটি দক্ষতা উন্নত করতে পারি?",
      a: "'ডেটা কোয়ালিটি অ্যান্ড ভ্যালিডেশন ফ্রেমওয়ার্কস' কোর্স (NSSTA, 3 দিন) সুপারিশ করা হয়।",
    },
  ],
  mr: [
    {
      q: "मला SQL का आवश्यक आहे?",
      a: "तुमची भूमिका (सांख्यिकी अधिकारी) सरकारी डेटासेटचे विश्लेषण करणे आवश्यक आहे.",
    },
    {
      q: "मी पुढे काय शिकावे?",
      a: "तुमची सर्वोच्च प्राधान्य SQL आहे.",
    },
    {
      q: "माझे सर्वात मोठे कौशल्य अंतर कोणते आहे?",
      a: "SQL आणि डेटा गुणवत्ता फ्रेमवर्क तुमची सर्वात मोठी अंतरे आहेत.",
    },
    {
      q: "मी माझी डेटा गुणवत्ता क्षमता कशी सुधारू शकतो?",
      a: "'डेटा क्वालिटी अँड व्हॅलिडेशन फ्रेमवर्क्स' कोर्स शिफारस केली आहे.",
    },
  ],
  gu: [
    {
      q: "મને SQL ની જરૂર શા માટે?",
      a: "તમારી ભૂમિકા (આંકડાશાસ્ત્રી અધિકારી) સરકારી ડેટાસેટનું વિશ્લેષણ કરવાની જરૂર છે.",
    },
    {
      q: "હું આગળ શું શીખું?",
      a: "તમારી ટોચની પ્રાધાન્યતા SQL છે.",
    },
    {
      q: "મારું સૌથી મોટું કૌશલ્ય અંતર કયું છે?",
      a: "SQL અને ડેટા ગુણવત્તા ફ્રેમવર્ક તમારા સૌથી મોટા અંતર છે.",
    },
    {
      q: "હું મારી ડેટા ગુણવત્તા ક્ષમતા કેવી રીતે સુધારી શકું?",
      a: "'ડેટા ક્વોલિટી એન્ડ વેલિડેશન ફ્રેમવર્ક્સ' કોર્સ ભલામણ કરવામાં આવે છે.",
    },
  ],
  kn: [
    {
      q: "ನನಗೆ SQL ಏಕೆ ಬೇಕು?",
      a: "ನಿಮ್ಮ ಪಾತ್ರ (ಸಂಖ್ಯಾಶಾಸ್ತ್ರ ಅಧಿಕಾರಿ) ಸರ್ಕಾರಿ ಡೇಟಾಸೆಟ್‌ಗಳನ್ನು ವಿಶ್ಲೇಷಿಸಬೇಕು.",
    },
    {
      q: "ನಾನು ಮುಂದೆ ಏನು ಕಲಿಯಬೇಕು?",
      a: "ನಿಮ್ಮ ಅಗ್ರ ಆದ್ಯತೆ SQL ಆಗಿದೆ.",
    },
    {
      q: "ನನ್ನ ಅತಿದೊಡ್ಡ ಕೌಶಲ ಅಂತರ ಯಾವುದು?",
      a: "SQL ಮತ್ತು ಡೇಟಾ ಗುಣಮಟ್ಟದ ಚೌಕಟ್ಟುಗಳು ನಿಮ್ಮ ಅತಿದೊಡ್ಡ ಅಂತರಗಳು.",
    },
    {
      q: "ನನ್ನ ಡೇಟಾ ಗುಣಮಟ್ಟದ ಸಾಮರ್ಥ್ಯವನ್ನು ಹೇಗೆ ಸುಧಾರಿಸುವುದು?",
      a: "'ಡೇಟಾ ಕ್ವಾಲಿಟಿ ಅಂಡ್ ವ್ಯಾಲಿಡೇಶನ್ ಫ್ರೇಮ್‌ವರ್ಕ್ಸ್' ಕೋರ್ಸ್ ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ.",
    },
  ],
  ml: [
    {
      q: "എനിക്ക് SQL എന്തിനാണ് ആവശ്യം?",
      a: "നിങ്ങളുടെ റോൾ (സ്റ്റാറ്റിസ്റ്റിക്കൽ ഓഫീസർ) സർക്കാർ ഡാറ്റാസെറ്റുകൾ വിശകലനം ചെയ്യേണ്ടതുണ്ട്.",
    },
    {
      q: "ഞാൻ അടുത്തതായി എന്ത് പഠിക്കണം?",
      a: "നിങ്ങളുടെ മുൻഗണന SQL ആണ്.",
    },
    {
      q: "എന്റെ ഏറ്റവും വലിയ കഴിവ് വിടവ് ഏതാണ്?",
      a: "SQL ഉം ഡാറ്റാ ക്വാളിറ്റി ഫ്രെയിംവർക്കുകളും നിങ്ങളുടെ ഏറ്റവും വലിയ വിടവുകളാണ്.",
    },
    {
      q: "എന്റെ ഡാറ്റാ ക്വാളിറ്റി കഴിവ് എങ്ങനെ മെച്ചപ്പെടുത്താം?",
      a: "'ഡാറ്റാ ക്വാളിറ്റി ആൻഡ് വാലിഡേഷൻ ഫ്രെയിംവർക്കുകൾ' കോഴ്സ് ശുപാർശ ചെയ്യുന്നു.",
    },
  ],
  pa: [
    {
      q: "ਮੈਨੂੰ SQL ਦੀ ਲੋੜ ਕਿਉਂ ਹੈ?",
      a: "ਤੁਹਾਡੀ ਭੂਮਿਕਾ (ਅੰਕੜਾ ਅਧਿਕਾਰੀ) ਸਰਕਾਰੀ ਡੇਟਾਸੈੱਟਾਂ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰਨ ਦੀ ਲੋੜ ਹੈ.",
    },
    {
      q: "ਮੈਂ ਅੱਗੇ ਕੀ ਸਿੱਖਾਂ?",
      a: "ਤੁਹਾਦੀ ਸਿਖਰ ਤਰਜੀਹ SQL ਹੈ.",
    },
    {
      q: "ਮੇਰਾ ਸਭ ਤੋਂ ਵੱਡਾ ਹੁਨਰ ਪਾੜਾ ਕਿਹੜਾ ਹੈ?",
      a: "SQL ਅਤੇ ਡੇਟਾ ਗੁਣਵੱਤਾ ਫਰੇਮਵਰਕ ਤੁਹਾਡੇ ਸਭ ਤੋਂ ਵੱਡੇ ਪਾੜੇ ਹਨ.",
    },
    {
      q: "ਮੈਂ ਆਪਣੀ ਡੇਟਾ ਗੁਣਵੱਤਾ ਯੋਗਤਾ ਕਿਵੇਂ ਸੁਧਾਰਾਂ?",
      a: "'ਡੇਟਾ ਕੁਆਲਿਟੀ ਐਂਡ ਵੈਲੀਡੇਸ਼ਨ ਫਰੇਮਵਰਕਸ' ਕੋਰਸ ਸਿਫਾਰਸ਼ ਕੀਤਾ ਜਾਂਦਾ ਹੈ.",
    },
  ],
};

const FALLBACK: Record<string, string> = {
  en: "I can help with questions about your skill gaps, learning path, and assessment progress. Try asking about SQL, Data Quality, or your next recommended course.",
  hi: "मैं आपके कौशल अंतर, लर्निंग पाथ और आकलन प्रगति के बारे में सवालों में मदद कर सकता हूँ।",
  ta: "உங்கள் திறன் இடைவெளிகள், கற்றல் பாதை மற்றும் மதிப்பீட்டு முன்னேற்றம் பற்றிய கேள்விகளில் நான் உதவ முடியும்.",
  te: "మీ నైపుణ్య అంతరాలు, లెర్నింగ్ పాత్ మరియు మూల్యాంకన పురోగతి గురించి నేను సహాయం చేయగలను.",
  bn: "আপনার দক্ষতা শূন্যতা, লার্নিং পাথ এবং মূল্যায়ন অগ্রগতি সম্পর্কে আমি সাহায্য করতে পারি।",
  mr: "तुमच्या कौशल्य अंतर, लर्निंग पाथ आणि मूल्यांकन प्रगतीबद्दल मी मदत करू शकतो.",
  gu: "તમારા કૌશલ્ય અંતર, લર્નિંગ પાથ અને મૂલ્યાંકન પ્રગતિ વિશે હું મદદ કરી શકું છું.",
  kn: "ನಿಮ್ಮ ಕೌಶಲ ಅಂತರ, ಕಲಿಕೆ ಮಾರ್ಗ ಮತ್ತು ಮೌಲ್ಯಮಾಪನ ಪ್ರಗತಿ ಬಗ್ಗೆ ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ.",
  ml: "നിങ്ങളുടെ കഴിവ് വിടവുകൾ, ലേണിംഗ് പാത, മൂല്യനിർണ്ണയ പുരോഗതി എന്നിവയെക്കുറിച്ച് ഞാൻ സഹായിക്കാം.",
  pa: "ਤੁਹਾਡੇ ਹੁਨਰ ਪਾੜੇ, ਸਿਖਲਾਈ ਮਾਰਗ ਅਤੇ ਮੁਲਾਂਕਣ ਤਰੱਕੀ ਬਾਰੇ ਮੈਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ.",
};

// --- LLM hook (optional) ---------------------------------------------------

/**
 * LLM provider configuration.
 *
 * The AI service supports three LLM providers out of the box:
 *
 *   1. OpenRouter (default, recommended) — https://openrouter.ai
 *      Set OPENROUTER_API_KEY=sk-or-v1-...
 *      Optional: OPENROUTER_MODEL="openai/gpt-4o-mini" (or any model on
 *      OpenRouter's catalog: anthropic/claude-3.5-sonnet, google/gemini-flash-1.5,
 *      meta-llama/llama-3.1-70b-instruct, etc.)
 *
 *   2. OpenAI — set OPENAI_API_KEY=sk-...
 *      Optional: OPENAI_MODEL="gpt-4o-mini"
 *
 *   3. Any OpenAI-compatible endpoint (Groq, Together, Ollama, vLLM, etc.)
 *      Set LLM_BASE_URL=https://api.your-provider.com/v1
 *          LLM_API_KEY=...
 *          LLM_MODEL=...
 *
 * To enable LLM calls at all, set LLM_ENABLED=true. When disabled, only the
 * mock QA database is consulted — which is fine for the demo.
 *
 * The LLM is given a system prompt instructing it to reply in the user's
 * selected language. If the LLM call fails (rate limit, network, bad key),
 * the service falls back to a per-language canned response so the user
 * always sees something.
 */

const LLM_ENABLED = process.env.LLM_ENABLED === "true";

// Provider selection + fallback (OpenRouter -> NVIDIA -> OpenAI -> custom)
// now lives in ./llm.ts, shared by chat replies, assessment generation, and
// the new AI profile-summary feature.
const CONFIGURED_PROVIDERS = availableProviders();
const LLM_PROVIDER = CONFIGURED_PROVIDERS[0] ?? "none"; // for the startup log line only

const LANG_NAME: Record<string, string> = {
  en: "English",
  hi: "Hindi (Devanagari script)",
  ta: "Tamil",
  te: "Telugu",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  kn: "Kannada",
  ml: "Malayalam",
  pa: "Punjabi (Gurmukhi script)",
};

async function callLlm(text: string, lang: string): Promise<string | null> {
  if (!LLM_ENABLED) return null;
  const langName = LANG_NAME[lang] || "English";

  const result = await chatComplete([
    {
      role: "system",
      content: `You are Saksham, a skill-intelligence assistant for Indian government employees. The user is a Statistical Officer analysing government datasets. Reply in ${langName}. Be concise (max 3 sentences). If the question is off-topic, gently steer back to skill gaps, learning paths, or assessments.`,
    },
    { role: "user", content: text },
  ], { maxTokens: 250, temperature: 0.3 });

  return result?.content ?? null;
}

// --- Mock matcher ----------------------------------------------------------

function mockMatch(lang: string, text: string): string | null {
  const bank = QA_BY_LANG[lang] || QA_BY_LANG.en;
  const lower = text.toLowerCase().trim();
  // Exact-substring match
  for (const qa of bank) {
    if (lower.includes(qa.q.toLowerCase())) return qa.a;
  }
  // Keyword overlap (words > 3 chars)
  for (const qa of bank) {
    const words = qa.q.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    if (words.some((w) => lower.includes(w))) return qa.a;
  }
  return null;
}

// --- Assessment generation (Workstream C.4) ---------------------------------

type GeneratedQuestion = { q: string; options: string[]; answer: number; explanation: string };

/** Ask the LLM to produce an MCQ bank as strict JSON. */
async function generateViaLlm(
  competency: string,
  title: string,
  count: number,
  difficulty: string,
): Promise<GeneratedQuestion[] | null> {
  if (!LLM_ENABLED) return null;

  const result = await chatComplete(
    [
      {
        role: "system",
        content:
          'You generate multiple-choice assessment questions for Indian government capacity-building programmes. Respond with STRICT JSON only — no markdown fences, no commentary — shaped as: {"questions":[{"q":"...","options":["...","...","...","..."],"answer":0,"explanation":"..."}]} where "answer" is the zero-based index of the correct option. Every question must have exactly 4 options.',
      },
      {
        role: "user",
        content: `Generate ${count} ${difficulty}-level multiple-choice questions for the assessment "${title}" on the competency "${competency}" in the context of Indian government workforce training (e.g. data analysis, governance, service delivery).`,
      },
    ],
    { maxTokens: 2000, temperature: 0.4 },
  );
  if (!result) return null;

  try {
    const cleaned = result.content
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { questions?: GeneratedQuestion[] };
    if (!Array.isArray(parsed.questions)) return null;
    const valid = parsed.questions.filter(
      (q) =>
        typeof q.q === "string" &&
        Array.isArray(q.options) &&
        q.options.length === 4 &&
        Number.isInteger(q.answer) &&
        q.answer >= 0 &&
        q.answer < 4,
    );
    return valid.length > 0 ? valid.slice(0, count) : null;
  } catch (e) {
    console.warn("[ai-service] generate_assessment JSON parse failed:", e);
    return null;
  }
}

// --- AI Profile Summary (whole-profile, generated on submission) -----------

export type ProfileSummaryInput = {
  userName: string;
  designation: string | null;
  department: string | null;
  competencies: Array<{ name: string; current: number; required: number }>;
  attempts: Array<{
    assessmentTitle: string;
    assessmentCompetency: string;
    score: number | null;
    prevLevel: number | null;
    newLevel: number | null;
    submittedAt: string | null;
  }>;
  assignments: Array<{
    title: string;
    type: string;
    status: string;
  }>;
};

async function generateProfileSummary(
  input: ProfileSummaryInput,
): Promise<{ content: string; provider: string; model: string } | null> {
  const compLines = input.competencies
    .map((c) => `- ${c.name}: current level ${c.current}/5, required ${c.required}/5`)
    .join("\n") || "- (no competency data yet)";
  const attemptLines =
    input.attempts
      .slice(0, 25)
      .map(
        (a) =>
          `- ${a.assessmentTitle} (${a.assessmentCompetency}): score ${a.score ?? "n/a"}%, level ${a.prevLevel ?? "?"} -> ${a.newLevel ?? "?"}${a.submittedAt ? `, on ${a.submittedAt}` : ""}`,
      )
      .join("\n") || "- (no assessment attempts yet)";
  const assignmentLines =
    input.assignments
      .slice(0, 25)
      .map((a) => `- ${a.title} (${a.type}): ${a.status}`)
      .join("\n") || "- (no assignments)";

  const messages: ChatMessageLike[] = [
    {
      role: "system",
      content:
        "You are Saksham, a skill-intelligence assistant writing a short performance summary for an Indian government employee's training profile. Use the FULL profile data given (all past assessment attempts, current competency levels, and assignment history) — not just the most recent attempt — to describe overall trends, strengths, persistent gaps, and a concrete next-step recommendation. Write 3-5 sentences, plain language, encouraging but honest tone, no markdown.",
    },
    {
      role: "user",
      content: `Employee: ${input.userName}${input.designation ? `, ${input.designation}` : ""}${input.department ? ` (${input.department})` : ""}.

Competencies:
${compLines}

Assessment attempt history (most recent first):
${attemptLines}

Assignment history:
${assignmentLines}

Write the whole-profile summary now.`,
    },
  ];

  if (!LLM_ENABLED) {
    return {
      content: mockProfileSummary(input),
      provider: "mock",
      model: "mock",
    };
  }

  const result = await chatComplete(messages, { maxTokens: 400, temperature: 0.4 });
  if (!result) {
    return { content: mockProfileSummary(input), provider: "mock", model: "mock" };
  }
  return { content: result.content.trim(), provider: result.provider, model: result.model };
}

/** Deterministic offline fallback for the profile summary (LLM off/unreachable). */
function mockProfileSummary(input: ProfileSummaryInput): string {
  const gaps = input.competencies
    .filter((c) => c.current < c.required)
    .sort((a, b) => b.required - b.current - (a.required - a.current));
  const topGap = gaps[0];
  const attemptCount = input.attempts.length;
  const avgScore = attemptCount
    ? Math.round(
        input.attempts.reduce((s, a) => s + (a.score ?? 0), 0) / attemptCount,
      )
    : null;
  const parts: string[] = [];
  parts.push(
    attemptCount
      ? `${input.userName} has completed ${attemptCount} assessment${attemptCount === 1 ? "" : "s"} with an average score of ${avgScore}%.`
      : `${input.userName} has not yet completed any assessments.`,
  );
  if (topGap) {
    parts.push(
      `The largest current gap is in ${topGap.name}, at level ${topGap.current}/5 against a required level of ${topGap.required}/5.`,
    );
  } else if (input.competencies.length) {
    parts.push("All tracked competencies currently meet or exceed the required level.");
  }
  const pending = input.assignments.filter((a) => a.status === "PENDING" || a.status === "STARTED");
  if (pending.length) {
    parts.push(`${pending.length} assignment${pending.length === 1 ? " is" : "s are"} still pending completion.`);
  }
  parts.push(
    topGap
      ? `Recommended next step: prioritise closing the ${topGap.name} gap through the assigned learning path.`
      : "Recommended next step: maintain current levels with periodic refresher assessments.",
  );
  return parts.join(" ");
}

type ChatMessageLike = { role: "system" | "user" | "assistant"; content: string };

/** Deterministic offline fallback — derives simple recall questions. */
function generateMock(competency: string, count: number, difficulty: string): GeneratedQuestion[] {
  const templates: Array<(c: string) => GeneratedQuestion> = [
    (c) => ({
      q: `Which statement best describes the purpose of ${c} in government data work?`,
      options: [
        `It structures how ${c} is applied to official datasets and decisions`,
        `It replaces the need for domain expertise entirely`,
        `It is only relevant for private-sector analytics`,
        `It is a filing requirement with no analytical value`,
      ],
      answer: 0,
      explanation: `${c} provides the working foundation for handling official datasets and supporting decisions.`,
    }),
    (c) => ({
      q: `A team member is new to ${c}. Which sequence builds competence most reliably?`,
      options: [
        `Fundamentals first, then guided practice, then independent work with review`,
        `Independent work first, fundamentals later if problems arise`,
        `Memorising terminology without hands-on practice`,
        `Skipping basics and starting with the hardest cases`,
      ],
      answer: 0,
      explanation: `Competence in ${c} grows fastest with a fundamentals-first, practice-with-review sequence.`,
    }),
    (c) => ({
      q: `During a ${c} review, which quality signal matters MOST for official reporting?`,
      options: [
        `Accuracy and completeness of the underlying data`,
        `The visual style of the final slide deck`,
        `How quickly the report was drafted`,
        `The length of the report`,
      ],
      answer: 0,
      explanation: `Accuracy and completeness of data is the primary quality signal in official ${c} work.`,
    }),
    (c) => ({
      q: `Which of these is the best way to keep ${c} skills current?`,
      options: [
        `Regular practice on real departmental datasets with feedback`,
        `Reading about ${c} once a year`,
        `Avoiding new tools or methods`,
        `Delegating all ${c} work to consultants`,
      ],
      answer: 0,
      explanation: `Deliberate practice on real data with feedback keeps ${c} skills current.`,
    }),
  ];
  const out: GeneratedQuestion[] = [];
  for (let i = 0; i < count; i++) {
    out.push(templates[i % templates.length](competency));
  }
  return out.slice(0, count);
}

// --- Server ----------------------------------------------------------------

const httpServer = createServer();
const io = new Server(httpServer, {
  path: "/",
  cors: { origin: "*", methods: ["GET", "POST"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

io.on("connection", (socket) => {
  console.log(`[ai-service] connected: ${socket.id}`);

  socket.on(
    "ai_respond",
    async (payload: { text: string; lang?: string; email?: string }, ack?: (r: { answer?: string; error?: string }) => void) => {
      const lang = payload.lang || "en";
      const text = payload.text || "";

      console.log(
        `[ai-service] ai_respond lang=${lang} email=${payload.email ?? "-"} text=${text.slice(0, 80)}`,
      );

      // 1) Try mock match
      let answer = mockMatch(lang, text);

      // 2) Try LLM if mock didn't match
      if (answer == null && LLM_ENABLED) {
        answer = await callLlm(text, lang);
      }

      // 3) Fallback
      if (answer == null) {
        answer = FALLBACK[lang] || FALLBACK.en;
      }

      ack?.({ answer });
    },
  );

  // Workstream C.4 — AI Assessment Generator.
  socket.on(
    "generate_assessment",
    async (
      payload: { title: string; competency: string; count?: number; difficulty?: string },
      ack?: (r: { questions?: GeneratedQuestion[]; source?: "llm" | "mock"; error?: string }) => void,
    ) => {
      const title = (payload.title || "").trim();
      const competency = (payload.competency || "").trim();
      const count = Math.max(1, Math.min(20, Number(payload.count) || 4));
      const difficulty = payload.difficulty || "Intermediate";
      if (!title || !competency) {
        ack?.({ error: "title and competency are required" });
        return;
      }
      console.log(
        `[ai-service] generate_assessment count=${count} competency=${competency}`,
      );
      let questions = await generateViaLlm(competency, title, count, difficulty);
      let source: "llm" | "mock" = "llm";
      if (!questions) {
        questions = generateMock(competency, count, difficulty);
        source = "mock";
      }
      ack?.({ questions, source });
    },
  );

  socket.on("disconnect", () => {
    console.log(`[ai-service] disconnected: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(
    `[ai-service] socket.io listening on port ${PORT} | LLM=${LLM_ENABLED ? "on" : "off"} | providers=${CONFIGURED_PROVIDERS.join(",") || "none"} (fallback order, first=preferred)`,
  );
});

// --- Plain HTTP endpoint: /summarize-profile --------------------------------
// Called server-to-server from the Next.js app right after an attempt is
// submitted (fire-and-forget from the caller's point of view). Separate
// port from the socket.io server so we don't have to fight engine.io's
// request routing on path "/".

const AI_SERVICE_SECRET = process.env.AI_SERVICE_SECRET;

const restServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (req.method !== "POST" || req.url !== "/summarize-profile") {
    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "not found" }));
    return;
  }

  if (AI_SERVICE_SECRET) {
    const provided = req.headers["x-ai-service-secret"];
    if (provided !== AI_SERVICE_SECRET) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
  }

  let body = "";
  req.on("data", (chunk) => {
    body += chunk;
  });
  req.on("end", async () => {
    try {
      const parsed = JSON.parse(body || "{}") as { profile?: ProfileSummaryInput };
      if (!parsed.profile) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "profile is required" }));
        return;
      }
      const result = await generateProfileSummary(parsed.profile);
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result));
    } catch (e) {
      console.warn("[ai-service] /summarize-profile failed:", e);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "internal error" }));
    }
  });
});

restServer.listen(HTTP_PORT, () => {
  console.log(`[ai-service] REST endpoint listening on port ${HTTP_PORT} (/summarize-profile)`);
});

// Graceful shutdown
const shutdown = () => {
  console.log("[ai-service] shutting down…");
  restServer.close();
  httpServer.close(() => process.exit(0));
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
