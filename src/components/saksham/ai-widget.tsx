"use client";

/**
 * Saksham AI Assistant — floating chat widget with multilingual replies.
 *
 * Per the user's clarification ("Both"):
 *   - Default behaviour: AI replies in the UI's current language.
 *   - User can override the reply language per-chat via a dropdown in the
 *     widget header ("AI reply language"). The override persists across
 *     sessions.
 *
 * Two backends are wired up:
 *   1. The socket.io mini-service at port 3003 (mock + LLM) — preferred.
 *   2. A pure client-side mock that pattern-matches known questions in
 *      ai.json against the user's input, in any of the 10 supported
 *      languages. Used when the socket is unreachable.
 *
 * Either way, the user sees a response in their selected language within
 * ~1 second.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { io, type Socket } from "socket.io-client";
import { Bot, Send, X, Globe, Sparkles, Volume2, Square } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { aiSocketUrl } from "@/lib/socket-url";
import { LANGS, type LangCode } from "@/lib/i18n";
import { aiQa } from "@/lib/data";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

type Msg = { from: "ai" | "user"; text: string };

/** Per-question AI responses, translated into all 10 Saksham languages. */
const AI_QA_BY_LANG: Record<LangCode, Array<{ q: string; a: string }>> = {
  en: aiQa,
  hi: [
    {
      q: "मुझे SQL की आवश्यकता क्यों है?",
      a: "आपकी भूमिका (सांख्यिकी अधिकारी) के लिए सरकारी डेटासेट का विश्लेषण करना आवश्यक है। इसके लिए SQL उन्नत स्तर (4/5) पर चाहिए; आपका वर्तमान स्तर मध्यवर्ती (2/5) है — 2 स्तर का अंतर, आपकी प्रोफ़ाइल का सबसे बड़ा अंतर। इसे पूरा करने से मैन्युअल डेटा हैंडलिंग में लगने वाला समय कम होगा।",
    },
    {
      q: "मुझे आगे क्या सीखना चाहिए?",
      a: "अंतर के आकार और भूमिका की प्रासंगिकता के आधार पर, आपकी सर्वोच्च प्राथमिकता SQL है, उसके बाद डेटा गुणवत्ता फ्रेमवर्क। आप पहले से ही अपने SQL लर्निंग पाथ के चरण 2 में हैं — 'एडवांस्ड SQL फॉर गवर्नमेंट डेटा'।",
    },
    {
      q: "मेरा सबसे बड़ा कौशल अंतर कौन सा है?",
      a: "SQL और डेटा गुणवत्ता फ्रेमवर्क आपके सबसे बड़े अंतर हैं — दोनों आपकी भूमिका के लिए आवश्यक स्तर से 2 स्तर नीचे हैं।",
    },
    {
      q: "मैं अपनी डेटा गुणवत्ता दक्षता कैसे सुधार सकता हूँ?",
      a: "'डेटा क्वालिटी एंड वैलिडेशन फ्रेमवर्क्स' कोर्स (NSSTA, 3 दिन) अनुशंसित है। यह आपके व्यक्तिगत लर्निंग पाथ का चरण 3 है, और एक 'डेटा क्वालिटी असेसमेंट' भी उपलब्ध है जब आप सुधार प्रदर्शित करने के लिए तैयार हों।",
    },
  ],
  ta: [
    {
      q: "எனக்கு SQL ஏன் தேவை?",
      a: "உங்கள் பங்கு (புள்ளியியல் அதிகாரி) அரசு தரவுத்தொகுப்புகளை பகுப்பாய்வு செய்ய வேண்டும். அதற்கு SQL மேம்பட்ட நிலை (4/5) தேவை; உங்கள் தற்போதைய நிலை இடைநிலை (2/5) — 2 நிலை இடைவெளி, உங்கள் சுயவிவரத்தின் மிகப்பெரிய இடைவெளி. இதை நிரப்புவது கைமுறை தரவு கையாளுதலில் செலவழிக்கும் நேரத்தைக் குறைக்கும்.",
    },
    {
      q: "நான் அடுத்ததாக என்ன கற்க வேண்டும்?",
      a: "இடைவெளி அளவு மற்றும் பங்கு தொடர்பின் அடிப்படையில், உங்கள் முக்கிய முன்னுரிமை SQL, அதற்கடுத்தது தரவு தர கட்டமைப்புகள். நீங்கள் ஏற்கனவே உங்கள் SQL கற்றல் பாதையின் கட்டம் 2-இல் உள்ளீர்கள் — 'அரசு தரவுக்கான மேம்பட்ட SQL'.",
    },
    {
      q: "எனது மிகப்பெரிய திறன் இடைவெளி எது?",
      a: "SQL மற்றும் தரவு தர கட்டமைப்புகள் உங்கள் மிகப்பெரிய இடைவெளிகள் — இரண்டும் உங்கள் பங்குக்கு தேவையான நிலையை விட 2 நிலைகள் குறைவாக உள்ளன.",
    },
    {
      q: "எனது தரவு தர திறனை எப்படி மேம்படுத்துவது?",
      a: "'தரவு தரம் மற்றும் சரிபார்ப்பு கட்டமைப்புகள்' பாடநெறி (NSSTA, 3 நாட்கள்) பரிந்துரைக்கப்படுகிறது. இது உங்கள் தனிப்பயன் கற்றல் பாதையின் கட்டம் 3, மேலும் ஒரு 'தரவு தர மதிப்பீடு' உங்கள் மேம்பாட்டை நிரூபிக்க தயாராக உள்ளது.",
    },
  ],
  te: [
    {
      q: "నాకు SQL ఎందుకు అవసరం?",
      a: "మీ పాత్ర (గణాంక అధికారి) ప్రభుత్వ డేటాసెట్‌లను విశ్లేషించాలి. దానికి SQL అధునాతన స్థాయి (4/5) కావాలి; మీ ప్రస్తుత స్థాయి మధ్యస్థం (2/5) — 2 స్థాయిల అంతరం, మీ ప్రొఫైల్‌లో అతిపెద్ద అంతరం. దీన్ని పూరించడం మాన్యువల్ డేటా హ్యాండ్లింగ్‌లో గడిపే సమయాన్ని తగ్గిస్తుంది.",
    },
    {
      q: "నేను తదుపరిది ఏమి నేర్చుకోవాలి?",
      a: "అంతర పరిమాణం మరియు పాత్ర సంబంధం ఆధారంగా, మీ అగ్ర ప్రాధాన్యత SQL, తర్వాత డేటా క్వాలిటీ ఫ్రేమ్‌వర్క్‌లు. మీరు ఇప్పటికే మీ SQL లెర్నింగ్ పాత్ 2వ దశలో ఉన్నారు — 'అడ్వాన్స్డ్ SQL ఫర్ గవర్నమెంట్ డేటా'.",
    },
    {
      q: "నా అతిపెద్ద నైపుణ్య అంతరం ఏది?",
      a: "SQL మరియు డేటా క్వాలిటీ ఫ్రేమ్‌వర్క్‌లు మీ అతిపెద్ద అంతరాలు — రెండూ మీ పాత్రకు అవసరమైన స్థాయి కంటే 2 స్థాయిలు తక్కువగా ఉన్నాయి.",
    },
    {
      q: "నా డేటా క్వాలిటీ సామర్థ్యాన్ని ఎలా మెరుగుపరచాలి?",
      a: "'డేటా క్వాలిటీ అండ్ వాలిడేషన్ ఫ్రేమ్‌వర్క్స్' కోర్సు (NSSTA, 3 రోజులు) సిఫార్సు చేయబడింది. ఇది మీ వ్యక్తిగత లెర్నింగ్ పాత్ 3వ దశ, మరియు మీరు మెరుగుదల ప్రదర్శించడానికి సిద్ధంగా ఉన్నప్పుడు 'డేటా క్వాలిటీ అసెస్‌మెంట్' కూడా అందుబాటులో ఉంది.",
    },
  ],
  bn: [
    {
      q: "আমার SQL কেন দরকার?",
      a: "আপনার ভূমিকা (পরিসংখ্যান অফিসার) সরকারি ডেটাসেট বিশ্লেষণ করতে হবে। এর জন্য SQL অ্যাডভান্সড স্তরে (4/5) দরকার; আপনার বর্তমান স্তর মধ্যবর্তী (2/5) — 2 স্তরের ব্যবধান, আপনার প্রোফাইলের সবচেয়ে বড় শূন্যতা। এটি পূরণ করলে ম্যানুয়াল ডেটা হ্যান্ডলিংয়ে ব্যয়িত সময় কমবে।",
    },
    {
      q: "আমি পরবর্তী কী শিখব?",
      a: "ব্যবধানের আকার এবং ভূমিকা প্রাসঙ্গিকতার ভিত্তিতে, আপনার শীর্ষ অগ্রাধিকার SQL, এরপর ডেটা কোয়ালিটি ফ্রেমওয়ার্ক। আপনি ইতিমধ্যে আপনার SQL লার্নিং পাথের ধাপ ২-এ আছেন — 'অ্যাডভান্সড SQL ফর গভর্নমেন্ট ডেটা'।",
    },
    {
      q: "আমার সবচেয়ে বড় দক্ষতা শূন্যতা কোনটি?",
      a: "SQL এবং ডেটা কোয়ালিটি ফ্রেমওয়ার্ক আপনার সবচেয়ে বড় শূন্যতা — উভয়ই আপনার ভূমিকার জন্য প্রয়োজনীয় স্তরের চেয়ে 2 স্তর নিচে।",
    },
    {
      q: "আমি কীভাবে আমার ডেটা কোয়ালিটি দক্ষতা উন্নত করতে পারি?",
      a: "'ডেটা কোয়ালিটি অ্যান্ড ভ্যালিডেশন ফ্রেমওয়ার্কস' কোর্স (NSSTA, 3 দিন) সুপারিশ করা হয়। এটি আপনার ব্যক্তিগত লার্নিং পাথের ধাপ 3, এবং আপনি উন্নতি প্রদর্শনের জন্য প্রস্তুত হলে একটি 'ডেটা কোয়ালিটি অ্যাসেসমেন্ট' উপলব্ধ।",
    },
  ],
  mr: [
    {
      q: "मला SQL का आवश्यक आहे?",
      a: "तुमची भूमिका (सांख्यिकी अधिकारी) सरकारी डेटासेटचे विश्लेषण करणे आवश्यक आहे. त्यासाठी SQL प्रगत पातळीवर (4/5) हवे; तुमची सध्याची पातळी मध्यवर्ती (2/5) आहे — 2 स्तरांचे अंतर, तुमच्या प्रोफाइलमधील सर्वात मोठे अंतर. हे भरून काढल्यास मॅन्युअल डेटा हाताळणीत घालवलेला वेळ कमी होईल.",
    },
    {
      q: "मी पुढे काय शिकावे?",
      a: "अंतराच्या आकारानुसार आणि भूमिका प्रासंगिकतेनुसार, तुमची सर्वोच्च प्राधान्य SQL आहे, त्यानंतर डेटा गुणवत्ता फ्रेमवर्क. तुम्ही आधीच तुमच्या SQL लर्निंग पाथच्या टप्प्यावर आहात — 'अडव्हान्स्ड SQL फॉर गव्हर्नमेंट डेटा'.",
    },
    {
      q: "माझे सर्वात मोठे कौशल्य अंतर कोणते आहे?",
      a: "SQL आणि डेटा गुणवत्ता फ्रेमवर्क तुमची सर्वात मोठी अंतरे आहेत — दोन्ही तुमच्या भूमिकेसाठी आवश्यक स्तरापेक्षा 2 स्तर खाली आहेत.",
    },
    {
      q: "मी माझी डेटा गुणवत्ता क्षमता कशी सुधारू शकतो?",
      a: "'डेटा क्वालिटी अँड व्हॅलिडेशन फ्रेमवर्क्स' कोर्स (NSSTA, 3 दिवस) शिफारस केली आहे. हे तुमच्या वैयक्तिक लर्निंग पाथचे टप्पे 3 आहे, आणि तुम्ही सुधारणा दर्शविण्यासाठी तयार असल्यास 'डेटा क्वालिटी असेसमेंट' उपलब्ध आहे.",
    },
  ],
  gu: [
    {
      q: "મને SQL ની જરૂર શા માટે?",
      a: "તમારી ભૂમિકા (આંકડાશાસ્ત્રી અધિકારી) સરકારી ડેટાસેટનું વિશ્લેષણ કરવાની જરૂર છે. તેના માટે SQL અદ્યતન સ્તરે (4/5) જોઈએ; તમારું વર્તમાન સ્તર મધ્યવર્તી (2/5) છે — 2 સ્તરનું અંતર, તમારી પ્રોફાઇલનું સૌથી મોટું અંતર. આ પૂર્ણ કરવાથી મેન્યુઅલ ડેટા હેન્ડલિંગમાં વિતાવેલો સમય ઘટશે.",
    },
    {
      q: "હું આગળ શું શીખું?",
      a: "અંતરના કદ અને ભૂમિકા સંબંધના આધારે, તમારી ટોચની પ્રાધાન્યતા SQL છે, તે પછી ડેટા ગુણવત્તા ફ્રેમવર્ક. તમે પહેલેથી જ તમારા SQL લર્નિંગ પાથના તબક્કા 2 પર છો — 'એડવાન્સ્ડ SQL ફોર ગવર્નમેન્ટ ડેટા'.",
    },
    {
      q: "મારું સૌથી મોટું કૌશલ્ય અંતર કયું છે?",
      a: "SQL અને ડેટા ગુણવત્તા ફ્રેમવર્ક તમારા સૌથી મોટા અંતર છે — બંને તમારી ભૂમિકા માટે જરૂરી સ્તર કરતાં 2 સ્તર નીચે છે.",
    },
    {
      q: "હું મારી ડેટા ગુણવત્તા ક્ષમતા કેવી રીતે સુધારી શકું?",
      a: "'ડેટા ક્વોલિટી એન્ડ વેલિડેશન ફ્રેમવર્ક્સ' કોર્સ (NSSTA, 3 દિવસ) ભલામણ કરવામાં આવે છે. તે તમારા વ્યક્તિગત લર્નિંગ પાથનું તબક્કો 3 છે, અને તમે સુધારો દર્શાવવા તૈયાર હોય ત્યારે 'ડેટા ક્વોલિટી એસેસમેન્ટ' ઉપલબ્ધ છે.",
    },
  ],
  kn: [
    {
      q: "ನನಗೆ SQL ಏಕೆ ಬೇಕು?",
      a: "ನಿಮ್ಮ ಪಾತ್ರ (ಸಂಖ್ಯಾಶಾಸ್ತ್ರ ಅಧಿಕಾರಿ) ಸರ್ಕಾರಿ ಡೇಟಾಸೆಟ್‌ಗಳನ್ನು ವಿಶ್ಲೇಷಿಸಬೇಕು. ಅದಕ್ಕೆ SQL ಸುಧಾರಿತ ಮಟ್ಟದಲ್ಲಿ (4/5) ಬೇಕು; ನಿಮ್ಮ ಪ್ರಸ್ತುತ ಮಟ್ಟ ಮಧ್ಯಮ (2/5) — 2 ಮಟ್ಟಗಳ ಅಂತರ, ನಿಮ್ಮ ಪ್ರೊಫೈಲ್‌ನ ಅತಿದೊಡ್ಡ ಅಂತರ. ಇದನ್ನು ತುಂಬಿದರೆ ಹಸ್ತಚಾಲಿತ ಡೇಟಾ ನಿರ್ವಹಣೆಯಲ್ಲಿ ಕಳೆಯುವ ಸಮಯ ಕಡಿಮೆಯಾಗುತ್ತದೆ.",
    },
    {
      q: "ನಾನು ಮುಂದೆ ಏನು ಕಲಿಯಬೇಕು?",
      a: "ಅಂತರದ ಗಾತ್ರ ಮತ್ತು ಪಾತ್ರ ಸಂಬಂಧದ ಆಧಾರದ ಮೇಲೆ, ನಿಮ್ಮ ಅಗ್ರ ಆದ್ಯತೆ SQL, ನಂತರ ಡೇಟಾ ಗುಣಮಟ್ಟದ ಚೌಕಟ್ಟುಗಳು. ನೀವು ಈಗಾಗಲೇ ನಿಮ್ಮ SQL ಕಲಿಕೆ ಮಾರ್ಗದ ಹಂತ 2 ರಲ್ಲಿದ್ದೀರಿ — 'ಅಡ್ವಾನ್ಸ್ಡ್ SQL ಫಾರ್ ಗವರ್ನಮೆಂಟ್ ಡೇಟಾ'.",
    },
    {
      q: "ನನ್ನ ಅತಿದೊಡ್ಡ ಕೌಶಲ ಅಂತರ ಯಾವುದು?",
      a: "SQL ಮತ್ತು ಡೇಟಾ ಗುಣಮಟ್ಟದ ಚೌಕಟ್ಟುಗಳು ನಿಮ್ಮ ಅತಿದೊಡ್ಡ ಅಂತರಗಳು — ಎರಡೂ ನಿಮ್ಮ ಪಾತ್ರಕ್ಕೆ ಅಗತ್ಯವಾದ ಮಟ್ಟಕ್ಕಿಂತ 2 ಮಟ್ಟಗಳು ಕಡಿಮೆ.",
    },
    {
      q: "ನನ್ನ ಡೇಟಾ ಗುಣಮಟ್ಟದ ಸಾಮರ್ಥ್ಯವನ್ನು ಹೇಗೆ ಸುಧಾರಿಸುವುದು?",
      a: "'ಡೇಟಾ ಕ್ವಾಲಿಟಿ ಅಂಡ್ ವ್ಯಾಲಿಡೇಶನ್ ಫ್ರೇಮ್‌ವರ್ಕ್ಸ್' ಕೋರ್ಸ್ (NSSTA, 3 ದಿನಗಳು) ಶಿಫಾರಸು ಮಾಡಲಾಗಿದೆ. ಇದು ನಿಮ್ಮ ವೈಯಕ್ತಿಕ ಕಲಿಕೆ ಮಾರ್ಗದ ಹಂತ 3, ಮತ್ತು ನೀವು ಸುಧಾರಣೆ ಪ್ರದರ್ಶಿಸಲು ಸಿದ್ಧರಿದ್ದಾಗ 'ಡೇಟಾ ಕ್ವಾಲಿಟಿ ಮೌಲ್ಯಮಾಪನ' ಲಭ್ಯವಿದೆ.",
    },
  ],
  ml: [
    {
      q: "എനിക്ക് SQL എന്തിനാണ് ആവശ്യം?",
      a: "നിങ്ങളുടെ റോൾ (സ്റ്റാറ്റിസ്റ്റിക്കൽ ഓഫീസർ) സർക്കാർ ഡാറ്റാസെറ്റുകൾ വിശകലനം ചെയ്യേണ്ടതുണ്ട്. അതിന് SQL വിപുലീകൃത നിലയിൽ (4/5) വേണം; നിങ്ങളുടെ നിലവിലെ നില ഇടത്തരം (2/5) ആണ് — 2 നിലകളുടെ വിടവ്, നിങ്ങളുടെ പ്രൊഫൈലിലെ ഏറ്റവും വലിയ വിടവ്. ഇത് നികത്തുന്നത് മാനുവൽ ഡാറ്റാ കൈകാര്യം ചെയ്യാൻ ചെലവഴിക്കുന്ന സമയം കുറയ്ക്കും.",
    },
    {
      q: "ഞാൻ അടുത്തതായി എന്ത് പഠിക്കണം?",
      a: "വിടവിന്റെ വലുപ്പവും റോൾ പ്രസക്തിയും അടിസ്ഥാനമാക്കി, നിങ്ങളുടെ മുൻഗണന SQL ആണ്, പിന്നെ ഡാറ്റാ ക്വാളിറ്റി ഫ്രെയിംവർക്കുകൾ. നിങ്ങൾ ഇതിനകം നിങ്ങളുടെ SQL ലേണിംഗ് പാതയുടെ ഘട്ടം 2-ൽ ആണ് — 'അഡ്വാൻസ്ഡ് SQL ഫോർ ഗവൺമെന്റ് ഡാറ്റാ'.",
    },
    {
      q: "എന്റെ ഏറ്റവും വലിയ കഴിവ് വിടവ് ഏതാണ്?",
      a: "SQL ഉം ഡാറ്റാ ക്വാളിറ്റി ഫ്രെയിംവർക്കുകളും നിങ്ങളുടെ ഏറ്റവും വലിയ വിടവുകളാണ് — രണ്ടും നിങ്ങളുടെ റോളിന് ആവശ്യമായ നിലയേക്കാൾ 2 നിലകൾ താഴെയാണ്.",
    },
    {
      q: "എന്റെ ഡാറ്റാ ക്വാളിറ്റി കഴിവ് എങ്ങനെ മെച്ചപ്പെടുത്താം?",
      a: "'ഡാറ്റാ ക്വാളിറ്റി ആൻഡ് വാലിഡേഷൻ ഫ്രെയിംവർക്കുകൾ' കോഴ്സ് (NSSTA, 3 ദിവസം) ശുപാർശ ചെയ്യുന്നു. ഇത് നിങ്ങളുടെ വ്യക്തിഗത ലേണിംഗ് പാതയുടെ ഘട്ടം 3 ആണ്, കൂടാതെ നിങ്ങൾ മെച്ചപ്പെടുത്തൽ പ്രദർശിപ്പിക്കാൻ തയ്യാറായാൽ ഒരു 'ഡാറ്റാ ക്വാളിറ്റി മൂല്യനിർണ്ണയം' ലഭ്യമാണ്.",
    },
  ],
  pa: [
    {
      q: "ਮੈਨੂੰ SQL ਦੀ ਲੋੜ ਕਿਉਂ ਹੈ?",
      a: "ਤੁਹਾਡੀ ਭੂਮਿਕਾ (ਅੰਕੜਾ ਅਧਿਕਾਰੀ) ਸਰਕਾਰੀ ਡੇਟਾਸੈੱਟਾਂ ਦਾ ਵਿਸ਼ਲੇਸ਼ਣ ਕਰਨ ਦੀ ਲੋੜ ਹੈ. ਇਸ ਲਈ SQL ਉੱਨਤ ਪੱਧਰ (4/5) 'ਤੇ ਚਾਹੀਦਾ ਹੈ; ਤੁਹਾਡਾ ਮੌਜੂਦਾ ਪੱਧਰ ਮੱਧਮ (2/5) ਹੈ — 2 ਪੱਧਰਾਂ ਦਾ ਪਾੜਾ, ਤੁਹਾਡੀ ਪ੍ਰੋਫਾਈਲ ਦਾ ਸਭ ਤੋਂ ਵੱਡਾ ਪਾੜਾ. ਇਸ ਨੂੰ ਪੂਰਾ ਕਰਨ ਨਾਲ ਮੈਨੂਅਲ ਡੇਟਾ ਹੈਂਡਲਿੰਗ ਵਿੱਚ ਬਿਤਾਇਆ ਸਮਾਂ ਘਟੇਗਾ.",
    },
    {
      q: "ਮੈਂ ਅੱਗੇ ਕੀ ਸਿੱਖਾਂ?",
      a: "ਪਾੜੇ ਦੇ ਆਕਾਰ ਅਤੇ ਭੂਮਿਕਾ ਪ੍ਰਸੰਗ ਦੇ ਆਧਾਰ 'ਤੇ, ਤੁਹਾਦੀ ਸਿਖਰ ਤਰਜੀਹ SQL ਹੈ, ਫਿਰ ਡੇਟਾ ਗੁਣਵੱਤਾ ਫਰੇਮਵਰਕ. ਤੁਸੀਂ ਪਹਿਲਾਂ ਹੀ ਆਪਣੇ SQL ਸਿਖਲਾਈ ਮਾਰਗ ਦੇ ਪੜਾਅ 2 'ਤੇ ਹੋ — 'ਅਡਵਾਂਸਡ SQL ਫਾਰ ਗਵਰਨਮੈਂਟ ਡੇਟਾ'.",
    },
    {
      q: "ਮੇਰਾ ਸਭ ਤੋਂ ਵੱਡਾ ਹੁਨਰ ਪਾੜਾ ਕਿਹੜਾ ਹੈ?",
      a: "SQL ਅਤੇ ਡੇਟਾ ਗੁਣਵੱਤਾ ਫਰੇਮਵਰਕ ਤੁਹਾਡੇ ਸਭ ਤੋਂ ਵੱਡੇ ਪਾੜੇ ਹਨ — ਦੋਵੇਂ ਤੁਹਾਡੀ ਭੂਮਿਕਾ ਲਈ ਲੋੜੀਂਦੇ ਪੱਧਰ ਤੋਂ 2 ਪੱਧਰ ਹੇਠਾਂ ਹਨ.",
    },
    {
      q: "ਮੈਂ ਆਪਣੀ ਡੇਟਾ ਗੁਣਵੱਤਾ ਯੋਗਤਾ ਕਿਵੇਂ ਸੁਧਾਰਾਂ?",
      a: "'ਡੇਟਾ ਕੁਆਲਿਟੀ ਐਂਡ ਵੈਲੀਡੇਸ਼ਨ ਫਰੇਮਵਰਕਸ' ਕੋਰਸ (NSSTA, 3 ਦਿਨ) ਸਿਫਾਰਸ਼ ਕੀਤਾ ਜਾਂਦਾ ਹੈ. ਇਹ ਤੁਹਾਡੇ ਵਿਅਕਤੀਗਤ ਸਿਖਲਾਈ ਮਾਰਗ ਦਾ ਪੜਾਅ 3 ਹੈ, ਅਤੇ ਜਦੋਂ ਤੁਸੀਂ ਸੁਧਾਰ ਦਰਸਾਉਣ ਲਈ ਤਿਆਰ ਹੋ ਤਾਂ ਇੱਕ 'ਡੇਟਾ ਕੁਆਲਿਟੀ ਮੁਲਾਂਕਣ' ਉਪਲਬਧ ਹੈ.",
    },
  ],
};

const SUGGESTED_QUESTIONS: Record<LangCode, string[]> = {
  en: [
    "Why do I need SQL?",
    "What should I learn next?",
    "Which competency is my biggest gap?",
    "How can I improve my Data Quality competency?",
  ],
  hi: [
    "मुझे SQL की आवश्यकता क्यों है?",
    "मुझे आगे क्या सीखना चाहिए?",
    "मेरा सबसे बड़ा कौशल अंतर कौन सा है?",
    "मैं अपनी डेटा गुणवत्ता दक्षता कैसे सुधार सकता हूँ?",
  ],
  ta: [
    "எனக்கு SQL ஏன் தேவை?",
    "நான் அடுத்ததாக என்ன கற்க வேண்டும்?",
    "எனது மிகப்பெரிய திறன் இடைவெளி எது?",
    "எனது தரவு தர திறனை எப்படி மேம்படுத்துவது?",
  ],
  te: [
    "నాకు SQL ఎందుకు అవసరం?",
    "నేను తదుపరిది ఏమి నేర్చుకోవాలి?",
    "నా అతిపెద్ద నైపుణ్య అంతరం ఏది?",
    "నా డేటా క్వాలిటీ సామర్థ్యాన్ని ఎలా మెరుగుపరచాలి?",
  ],
  bn: [
    "আমার SQL কেন দরকার?",
    "আমি পরবর্তী কী শিখব?",
    "আমার সবচেয়ে বড় দক্ষতা শূন্যতা কোনটি?",
    "আমি কীভাবে আমার ডেটা কোয়ালিটি দক্ষতা উন্নত করতে পারি?",
  ],
  mr: [
    "मला SQL का आवश्यक आहे?",
    "मी पुढे काय शिकावे?",
    "माझे सर्वात मोठे कौशल्य अंतर कोणते आहे?",
    "मी माझी डेटा गुणवत्ता क्षमता कशी सुधारू शकतो?",
  ],
  gu: [
    "મને SQL ની જરૂર શા માટે?",
    "હું આગળ શું શીખું?",
    "મારું સૌથી મોટું કૌશલ્ય અંતર કયું છે?",
    "હું મારી ડેટા ગુણવત્તા ક્ષમતા કેવી રીતે સુધારી શકું?",
  ],
  kn: [
    "ನನಗೆ SQL ಏಕೆ ಬೇಕು?",
    "ನಾನು ಮುಂದೆ ಏನು ಕಲಿಯಬೇಕು?",
    "ನನ್ನ ಅತಿದೊಡ್ಡ ಕೌಶಲ ಅಂತರ ಯಾವುದು?",
    "ನನ್ನ ಡೇಟಾ ಗುಣಮಟ್ಟದ ಸಾಮರ್ಥ್ಯವನ್ನು ಹೇಗೆ ಸುಧಾರಿಸುವುದು?",
  ],
  ml: [
    "എനിക്ക് SQL എന്തിനാണ് ആവശ്യം?",
    "ഞാൻ അടുത്തതായി എന്ത് പഠിക്കണം?",
    "എന്റെ ഏറ്റവും വലിയ കഴിവ് വിടവ് ഏതാണ്?",
    "എന്റെ ഡാറ്റാ ക്വാളിറ്റി കഴിവ് എങ്ങനെ മെച്ചപ്പെടുത്താം?",
  ],
  pa: [
    "ਮੈਨੂੰ SQL ਦੀ ਲੋੜ ਕਿਉਂ ਹੈ?",
    "ਮੈਂ ਅੱਗੇ ਕੀ ਸਿੱਖਾਂ?",
    "ਮੇਰਾ ਸਭ ਤੋਂ ਵੱਡਾ ਹੁਨਰ ਪਾੜਾ ਕਿਹੜਾ ਹੈ?",
    "ਮੈਂ ਆਪਣੀ ਡੇਟਾ ਗੁਣਵੱਤਾ ਯੋਗਤਾ ਕਿਵੇਂ ਸੁਧਾਰਾਂ?",
  ],
};

/** Fallback answers in each language, used when no QA match is found. */
const FALLBACK_BY_LANG: Record<LangCode, string> = {
  en: "I can help with questions about your skill gaps, learning path, and assessment progress. Try asking about SQL, Data Quality, or your next recommended course.",
  hi: "मैं आपके कौशल अंतर, लर्निंग पाथ और आकलन प्रगति के बारे में सवालों में मदद कर सकता हूँ। SQL, डेटा गुणवत्ता, या आपके अगले अनुशंसित कोर्स के बारे में पूछने का प्रयास करें।",
  ta: "உங்கள் திறன் இடைவெளிகள், கற்றல் பாதை மற்றும் மதிப்பீட்டு முன்னேற்றம் பற்றிய கேள்விகளில் நான் உதவ முடியும். SQL, தரவு தரம், அல்லது உங்கள் அடுத்த பரிந்துரைக்கப்பட்ட பாடநெறி பற்றி கேளுங்கள்.",
  te: "మీ నైపుణ్య అంతరాలు, లెర్నింగ్ పాత్ మరియు మూల్యాంకన పురోగతి గురించి నేను సహాయం చేయగలను. SQL, డేటా క్వాలిటీ, లేదా మీ తదుపరి సిఫార్సు కోర్సు గురించి అడగండి.",
  bn: "আপনার দক্ষতা শূন্যতা, লার্নিং পাথ এবং মূল্যায়ন অগ্রগতি সম্পর্কে আমি সাহায্য করতে পারি। SQL, ডেটা কোয়ালিটি, বা আপনার পরবর্তী সুপারিশকৃত কোর্স সম্পর্কে জিজ্ঞাসা করার চেষ্টা করুন।",
  mr: "तुमच्या कौशल्य अंतर, लर्निंग पाथ आणि मूल्यांकन प्रगतीबद्दल मी मदत करू शकतो. SQL, डेटा गुणवत्ता किंवा तुमचा पुढील शिफारसीत कोर्स याबद्दल विचारा.",
  gu: "તમારા કૌશલ્ય અંતર, લર્નિંગ પાથ અને મૂલ્યાંકન પ્રગતિ વિશે હું મદદ કરી શકું છું. SQL, ડેટા ગુણવત્તા, અથવા તમારો આગામી ભલામણ કોર્સ વિશે પૂછો.",
  kn: "ನಿಮ್ಮ ಕೌಶಲ ಅಂತರ, ಕಲಿಕೆ ಮಾರ್ಗ ಮತ್ತು ಮೌಲ್ಯಮಾಪನ ಪ್ರಗತಿ ಬಗ್ಗೆ ನಾನು ಸಹಾಯ ಮಾಡಬಲ್ಲೆ. SQL, ಡೇಟಾ ಗುಣಮಟ್ಟ, ಅಥವಾ ನಿಮ್ಮ ಮುಂದಿನ ಶಿಫಾರಸು ಕೋರ್ಸ್ ಬಗ್ಗೆ ಕೇಳಿ.",
  ml: "നിങ്ങളുടെ കഴിവ് വിടവുകൾ, ലേണിംഗ് പാത, മൂല്യനിർണ്ണയ പുരോഗതി എന്നിവയെക്കുറിച്ച് ഞാൻ സഹായിക്കാം. SQL, ഡാറ്റാ ക്വാളിറ്റി, അല്ലെങ്കിൽ നിങ്ങളുടെ അടുത്ത ശുപാർശ ചെയ്ത കോഴ്സ് എന്നിവയെക്കുറിച്ച് ചോദിക്കുക.",
  pa: "ਤੁਹਾਡੇ ਹੁਨਰ ਪਾੜੇ, ਸਿਖਲਾਈ ਮਾਰਗ ਅਤੇ ਮੁਲਾਂਕਣ ਤਰੱਕੀ ਬਾਰੇ ਮੈਂ ਮਦਦ ਕਰ ਸਕਦਾ ਹਾਂ. SQL, ਡੇਟਾ ਗੁਣਵੱਤਾ, ਜਾਂ ਤੁਹਾਡੇ ਅਗਲੇ ਸਿਫਾਰਸ਼ੀ ਕੋਰਸ ਬਾਰੇ ਪੁੱਛੋ.",
};

function localMatch(lang: LangCode, text: string): string {
  const bank = AI_QA_BY_LANG[lang] ?? AI_QA_BY_LANG.en;
  const lower = text.toLowerCase().trim();
  // Exact-substring match only — see the matching server-side comment in
  // mini-services/ai-service/index.ts's mockMatch() for why the old loose
  // keyword-overlap fallback (any shared word >3 chars, no word boundaries,
  // no punctuation stripping) was removed: it produced false positives for
  // almost any input.
  for (const qa of bank) {
    if (lower.includes(qa.q.toLowerCase())) return qa.a;
  }
  return FALLBACK_BY_LANG[lang] ?? FALLBACK_BY_LANG.en;
}

export function AiAssistantWidget() {
  const { session } = useAuth();
  const { t, lang, aiReplyLang, setAiReplyLang, resolvedAiLang } = useLang();
  const [open, setOpen] = useState(false);
  // Lazy-init the greeting so we don't need a useEffect that calls setState.
  const [messages, setMessages] = useState<Msg[]>(() => {
    if (!session) return [];
    return [
      {
        from: "ai",
        text: `${t("pages.welcome")}, ${session.name}! ${t("pages.aiSubtitle")}.`,
      },
    ];
    // Note: t and session are captured from the first render. If the user
    // changes UI language later, the greeting stays in the original language
    // — which is fine because it's a single welcome line and the rest of
    // the conversation flows in the new language anyway.
  });
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  // Read-aloud state: which AI message is currently being spoken.
  const [speakingIndex, setSpeakingIndex] = useState<number | null>(null);

  /** Read an AI message aloud in the resolved chat language. */
  const speak = useCallback(
    (text: string, index: number) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) {
        return;
      }
      if (speakingIndex === index) {
        window.speechSynthesis.cancel();
        setSpeakingIndex(null);
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const langMap: Record<string, string> = {
        en: "en-IN",
        hi: "hi-IN",
        ta: "ta-IN",
        te: "te-IN",
        bn: "bn-IN",
        mr: "mr-IN",
        gu: "gu-IN",
        kn: "kn-IN",
        ml: "ml-IN",
        pa: "pa-IN",
      };
      utterance.lang = langMap[resolvedAiLang] ?? "en-IN";
      utterance.onend = () => setSpeakingIndex(null);
      utterance.onerror = () => setSpeakingIndex(null);
      setSpeakingIndex(index);
      window.speechSynthesis.speak(utterance);
    },
    [resolvedAiLang, speakingIndex],
  );

  // Try to connect to the socket.io mini-service. If it fails we fall back
  // silently to the local mock so the AI Assistant still works.
  useEffect(() => {
    let s: Socket | null = null;
    try {
      s = io(aiSocketUrl(), {
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionAttempts: 3,
        timeout: 5000,
      });
      s.on("connect", () => {
        /* connected — server will respond to 'ai_respond' events */
      });
      socketRef.current = s;
    } catch {
      s = null;
    }
    return () => {
      s?.disconnect();
    };
  }, []);

  // Auto-scroll to the latest message.
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  // Move focus into the dialog when it opens (keyboard + screen readers).
  useEffect(() => {
    if (!open) return;
    const first = dialogRef.current?.querySelector<HTMLElement>("button");
    first?.focus();
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
      setSpeakingIndex(null);
    };
  }, [open]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setInput("");
    setMessages((m) => [...m, { from: "user", text: trimmed }]);
    setBusy(true);

    let answer: string | null = null;

    // Try the socket first (mock + LLM backend).
    if (socketRef.current?.connected) {
      answer = await new Promise<string | null>((resolve) => {
        const timer = setTimeout(() => resolve(null), 4000);
        socketRef.current?.emit(
          "ai_respond",
          { text: trimmed, lang: resolvedAiLang, email: session?.email },
          (resp: { answer?: string; error?: string } | undefined) => {
            clearTimeout(timer);
            if (resp?.answer) resolve(resp.answer);
            else resolve(null);
          },
        );
      });
    }

    // Fallback: local pattern match in the user's chosen language.
    if (answer == null) {
      await new Promise((r) => setTimeout(r, 400)); // tiny delay so the user sees a "thinking" beat
      answer = localMatch(resolvedAiLang, trimmed);
    }

    setMessages((m) => [...m, { from: "ai", text: answer! }]);
    setBusy(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={t("pages.aiTitle")}
        title={t("pages.aiTitle")}
        aria-haspopup="dialog"
        aria-expanded={false}
        className="fixed right-5 bottom-5 z-40 w-14 h-14 rounded-full bg-[var(--teal)] text-white grid place-items-center shadow-lg hover:opacity-90 transition"
      >
        <Sparkles size={24} />
      </button>
    );
  }

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t("pages.aiTitle")}
      ref={dialogRef}
      onKeyDown={(e) => {
        // Focus trap: keep Tab cycling inside the dialog while it is open.
        if (e.key !== "Tab") return;
        const focusables = dialogRef.current?.querySelectorAll<HTMLElement>(
          'button, input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!focusables || focusables.length === 0) return;
        const list = Array.from(focusables);
        const first = list[0];
        const last = list[list.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }}
      className="fixed right-5 bottom-5 z-40 w-[min(420px,calc(100vw-2.5rem))] h-[min(620px,calc(100vh-7.5rem))] flex flex-col bg-white rounded-2xl shadow-2xl border border-[var(--line)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--line)] bg-[var(--paper)]">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-[var(--teal-soft)] text-[var(--teal)] grid place-items-center shrink-0">
            <Bot size={16} />
          </div>
          <div className="min-w-0">
            <div className="font-semibold text-sm text-[var(--navy)] truncate">
              {t("pages.aiTitle")}
            </div>
            <div className="text-xs text-[var(--ink-soft)] truncate">
              {t("pages.aiSubtitle")}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close AI Assistant"
          className="w-11 h-11 rounded-full hover:bg-[var(--paper)] grid place-items-center"
        >
          <X size={16} />
        </button>
      </div>

      {/* Per-chat language override */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--line)] bg-[var(--paper)]/60">
        <Globe size={14} className="text-[var(--ink-soft)] shrink-0" />
        <span className="text-xs text-[var(--ink-soft)] shrink-0">
          {t("ui.aiLanguage")}:
        </span>
        <Select
          value={aiReplyLang}
          onValueChange={(v) => setAiReplyLang(v as typeof aiReplyLang)}
        >
          <SelectTrigger className="h-7 text-xs flex-1 min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">{t("ui.followUi")}</SelectItem>
            {LANGS.map((l) => (
              <SelectItem key={l.code} value={l.code}>
                {l.native}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Messages — a live log so new replies are announced by screen readers */}
      <div
        ref={scrollRef}
        role="log"
        aria-live="polite"
        aria-busy={busy}
        className="flex-1 overflow-y-auto scroll-thin px-4 py-3 space-y-3"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={cn(
              "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
              m.from === "user"
                ? "ml-auto bg-[var(--teal)] text-white rounded-br-md"
                : "bg-[var(--paper)] text-[var(--ink)] rounded-bl-md",
            )}
          >
            <div className="ai-answer">{m.text}</div>
            {m.from === "ai" ? (
              <button
                type="button"
                onClick={() => speak(m.text, i)}
                aria-label={
                  speakingIndex === i ? "Stop reading aloud" : "Read aloud"
                }
                aria-pressed={speakingIndex === i}
                title={speakingIndex === i ? "Stop" : "Read aloud"}
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-[var(--teal)] hover:underline"
              >
                {speakingIndex === i ? (
                  <Square size={11} />
                ) : (
                  <Volume2 size={11} />
                )}
                {speakingIndex === i ? "Stop" : "Read aloud"}
              </button>
            ) : null}
          </div>
        ))}

        {/* Suggested questions (only show before the user has sent anything beyond the greeting) */}
        {messages.length <= 1 && (
          <div className="pt-2 space-y-1.5">
            <div className="text-xs text-[var(--ink-soft)]">
              {t("ui.askSkillsGapsLearning")}
            </div>
            {SUGGESTED_QUESTIONS[resolvedAiLang].map((q, i) => (
              <button
                key={i}
                type="button"
                onClick={() => send(q)}
                className="block w-full text-left text-sm px-3 py-2 rounded-lg border border-[var(--line)] bg-white hover:border-[var(--teal)] hover:bg-[var(--paper)] transition"
              >
                {q}
              </button>
            ))}
          </div>
        )}

        {busy ? (
          <div
            className="bg-[var(--paper)] rounded-2xl rounded-bl-md px-3.5 py-2.5 text-sm text-[var(--ink-soft)] inline-flex items-center gap-1.5"
            role="status"
          >
            <span className="w-1.5 h-1.5 bg-[var(--teal)] rounded-full animate-bounce motion-reduce:animate-none" />
            <span className="w-1.5 h-1.5 bg-[var(--teal)] rounded-full animate-bounce motion-reduce:animate-none [animation-delay:0.15s]" />
            <span className="w-1.5 h-1.5 bg-[var(--teal)] rounded-full animate-bounce motion-reduce:animate-none [animation-delay:0.3s]" />
          </div>
        ) : null}
      </div>

      {/* Input */}
      <div className="flex items-center gap-2 px-3 py-3 border-t border-[var(--line)] bg-white">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder={t("common.typeMessage")}
          className="flex-1 px-3.5 py-2 text-sm rounded-full bg-[var(--paper)] border border-[var(--line)] focus:outline-none focus:border-[var(--teal)] focus:ring-2 focus:ring-[var(--teal)]/15 transition"
        />
        <button
          type="button"
          onClick={() => send(input)}
          disabled={!input.trim() || busy}
          aria-label={t("common.send")}
          className="w-11 h-11 rounded-full bg-[var(--teal)] text-white grid place-items-center hover:opacity-90 disabled:opacity-40 transition shrink-0"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
