"use strict";
// Multi-language support for FML Health — patient-facing messages.
// Templates in English, LLM generates in patient's language.

const TEMPLATES = {
  greeting: {
    en: "Hello {{name}}! Welcome to {{clinic}}. How can I help you today?",
    hi: "नमस्ते {{name}}! {{clinic}} में आपका स्वागत है। आज मैं आपकी कैसे मदद कर सकता हूँ?",
    ta: "வணக்கம் {{name}}! {{clinic}} க்கு வரவேற்கிறோம். இன்று நான் உங்களுக்கு எப்படி உதவ முடியும்?",
    te: "నమస్కారం {{name}}! {{clinic}} కి స్వాగతం. ఈ రోజు నేను మీకు ఎలా సహాయం చేయగలను?",
    mr: "नमस्कार {{name}}! {{clinic}} मध्ये आपले स्वागत आहे. आज मी तुम्हाला कशी मदत करू शकतो?",
    bn: "নমস্কার {{name}}! {{clinic}} তে আপনাকে স্বাগতম। আজ আমি আপনাকে কীভাবে সাহায্য করতে পারি?",
  },
  "book_appointment": {
    en: "I'd like to book an appointment with {{doctor}}.",
    hi: "मुझे {{doctor}} से अपॉइंटमेंट बुक करनी है।",
    ta: "நான் {{doctor}} உடன் ஒரு சந்திப்பை முன்பதிவு செய்ய விரும்புகிறேன்.",
    te: "నేను {{doctor}} తో అపాయింట్‌మెంట్ బుక్ చేయాలనుకుంటున్నాను.",
    mr: "मला {{doctor}} शी भेट बुक करायची आहे.",
    bn: "আমি {{doctor}} এর সাথে একটি অ্যাপয়েন্টমেন্ট বুক করতে চাই।",
  },
  "slot_available": {
    en: "Great! Available slots for {{date}}: {{slots}}. Which works for you?",
    hi: "बहुत अच्छा! {{date}} को उपलब्ध स्लॉट: {{slots}}। आपके लिए कौन सा ठीक है?",
    ta: "நல்லது! {{date}} அன்று கிடைக்கும் நேரம்: {{slots}}. உங்களுக்கு எது பொருத்தமா?",
    te: "అద్భుతం! {{date}} నాటి అందుబాటులో ఉన్న స్లాట్‌లు: {{slots}}. మీకు ఏది సరిపోతుంది?",
    mr: "छान! {{date}} रोजी उपलब्ध स्लॉट: {{slots}}. तुम्हाला कोणता योग्य आहे?",
    bn: "দারুণ! {{date}} তারিখে পাওয়া যাচ্ছে: {{slots}}। আপনার জন্য কোনটি ঠিক?",
  },
  "appointment_confirmed": {
    en: "Your appointment is confirmed!\nDoctor: {{doctor}}\nDate: {{date}}\nTime: {{time}}\nPlease arrive 15 minutes early.",
    hi: "आपकी अपॉइंटमेंट कन्फर्म हो गई!\nडॉक्टर: {{doctor}}\nतारीख: {{date}}\nसमय: {{time}}\nकृपया 15 मिनट पहले पहुँचें।",
    ta: "உங்கள் சந்திப்பு உறுதிசெய்யப்பட்டது!\nமருத்துவர்: {{doctor}}\nதேதி: {{date}}\nநேரம்: {{time}}\nதயவுசெய்து 15 நிமிடம் முன்பதலே வாருங்கள்.",
    te: "మీ అపాయింట్‌మెంట్ కన్ఫర్మ్ అయింది!\nడాక్టర్: {{doctor}}\nతేదీ: {{date}}\nసమయం: {{time}}\nదయచేసి 15 నిమిషాల ముందు రండి.",
    mr: "तुमची भेट निश्चित झाली आहे!\nडॉक्टर: {{doctor}}\nतारीख: {{date}}\nवेळ: {{time}}\nकृपया 15 मिनिटे लवकर या.",
    bn: "আপনার অ্যাপয়েন্টমেন্ট নিশ্চিত হয়েছে!\nডাক্টার: {{doctor}}\nতারিখ: {{date}}\nসময়: {{time}}\nদয়া করে ১৫ মিনিট আগে পৌঁছান।",
  },
  "prep_instructions": {
    en: "Pre-appointment instructions for your visit on {{date}}:\n{{instructions}}",
    hi: "{{date}} को आपकी विज़िट के लिए निर्देश:\n{{instructions}}",
    ta: "{{date}} அன்று உங்கள் வருகைக்கான வழிகாட்டுதல்கள்:\n{{instructions}}",
    te: "{{date}} నాటి మీ సందర్శన కోసం సూచనలు:\n{{instructions}}",
    mr: "{{date}} रोजी तुमच्या भेटीसाठी मार्गदर्शन:\n{{instructions}}",
    bn: "{{date}} তারিখে আপনার পরিদর্শনের জন্য নির্দেশনা:\n{{instructions}}",
  },
  aftercare: {
    en: "Post-visit care instructions:\n{{instructions}}\n\nFollow-up date: {{follow_up}}\nIf you experience {{warning}}, please contact us immediately.",
    hi: "विज़िट के बाद देखभाल के निर्देश:\n{{instructions}}\n\nफॉलो-अप तिथि: {{follow_up}}\nअगर आपको {{warning}} महसूस हो, तो तुरंत हमसे संपर्क करें।",
    ta: "வருகைக்குப் பின் பராமரிப்பு வழிகாட்டுதல்கள்:\n{{instructions}}\n\nதொடர் தேதி: {{follow_up}}\n{{warning}} ஏற்பட்டால், உடனே எங்களைத் தொடர்பு கொள்ளுங்கள்.",
    te: "సందర్శన తర్వాత సంరక్షణ సూచనలు:\n{{instructions}}\n\nఫలో-అప్ తేదీ: {{follow_up}}\n{{warning}} అనిపిస్తే, వెంటనే మమ్మల్ని సంప్రదించండి.",
    mr: "भेटीनंतर काळजी मार्गदर्शन:\n{{instructions}}\n\nपुढील भेट: {{follow_up}}\nतुम्हाला {{warning}} जाणवले तर लगेच आमच्याशी संपर्क साधा.",
    bn: "পরিদর্শনের পরের যত্ন নির্দেশনা:\n{{instructions}}\n\nফলো-আপ তারিখ: {{follow_up}}\n{{warning}} অনুভব করলে, অবিলম্বে আমাদের সাথে যোগাযোগ করুন।",
  },
  "review_request": {
    en: "Hi {{name}}! How was your visit to {{clinic}} today? We'd love your feedback: {{link}}",
    hi: "नमस्ते {{name}}! आज {{clinic}} में आपकी विज़िट कैसी रही? हमें आपकी प्रतिक्रिया चाहिए: {{link}}",
    ta: "வணக்கம் {{name}}! இன்று {{clinic}} இல் உங்கள் வருகை எப்படி இருந்தது? உங்கள் கருத்தை பகிர்ந்து கொள்ளுங்கள்: {{link}}",
    te: "నమస్కారం {{name}}! ఈ రోజు {{clinic}} లో మీ సందర్శన ఎలా ఉంది? మీ అభిప్రాయం మాకు కావాలి: {{link}}",
    mr: "नमस्कार {{name}}! आज {{clinic}} मधील तुमची भेट कशी होती? आम्हाला तुमचा अभिप्राय हवा आहे: {{link}}",
    bn: "নমস্কার {{name}}! আজ {{clinic}} তে আপনার পরিদর্শন কেমন ছিল? আমরা আপনার মতামত চাই: {{link}}",
  },
  "referral_share": {
    en: "Get a free consultation at {{clinic}}! Use my code: {{code}}. Book now: {{link}}",
    hi: "{{clinic}} में मुफ्त कंसल्टेशन पाएं! मेरा कोड इस्तेमाल करें: {{code}}। अभी बुक करें: {{link}}",
    ta: "{{clinic}} இல் இலவச ஆலோசனை பெறுங்கள்! என் குறியீட்டைப் பயன்படுத்துங்கள்: {{code}}. இப்போது முன்பதிவு செய்யுங்கள்: {{link}}",
    te: "{{clinic}} లో ఉచిత సంప్రదింపు పొందండి! నా కోడ్ వాడండి: {{code}}. ఇప్పుడు బుక్ చేయండి: {{link}}",
    mr: "{{clinic}} मध्ये विनामूल्य सल्ला मिळवा! माझा कोड वापरा: {{code}}. आत्ता बुक करा: {{link}}",
    bn: "{{clinic}} তে বিনামূল্যে পরামর্শ নিন! আমার কোড ব্যবহার করুন: {{code}}। এখনই বুক করুন: {{link}}",
  },
};

/**
 * Get a translated template for a given key and language.
 * Falls back to English if language not available.
 */
function getTemplate(key, lang = "en") {
  const set = TEMPLATES[key];
  if (!set) return key;
  return set[lang] || set.en || "";
}

/**
 * Fill {{placeholders}} in a template string.
 */
function fill(template, vars = {}) {
  let out = template;
  for (const [k, v] of Object.entries(vars)) {
    out = out.replace(new RegExp(`{{${k}}}`, "g"), v ?? "");
  }
  return out;
}

/**
 * Get a ready-to-send message in the patient's language.
 */
function patientMessage(key, lang, vars = {}) {
  const tmpl = getTemplate(key, lang);
  return fill(tmpl, vars);
}

/**
 * Detect language from a text string (simple heuristic).
 * Returns language code or 'en' as default.
 */
function detectLanguage(text) {
  if (!text) return "en";
  const lower = text.toLowerCase();
  // Devanagari (Hindi/Marathi)
  if (/[\u0900-\u097F]/.test(text)) return "hi";
  // Tamil
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta";
  // Telugu
  if (/[\u0C00-\u0C7F]/.test(text)) return "te";
  // Bengali
  if (/[\u0980-\u09FF]/.test(text)) return "bn";
  // Common Hindi words in Roman script
  if (/\b(namaste|namaskar|haan|nahi|kaise|theek|shukriya|dhanyavad)\b/i.test(lower)) return "hi";
  return "en";
}

const SUPPORTED_LANGUAGES = ["en", "hi", "ta", "te", "mr", "bn"];

module.exports = { getTemplate, fill, patientMessage, detectLanguage, SUPPORTED_LANGUAGES, TEMPLATES };
