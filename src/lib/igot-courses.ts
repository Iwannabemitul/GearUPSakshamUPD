/**
 * iGOT Karmayogi course catalog — sourced from the user-supplied
 * /home/z/my-project/upload/iGot_Karmayogi_courses.pdf (Sadhana Saptah, 2-8 April 2026).
 *
 * Two program tracks are represented:
 *   1. AI Daksh Program (16 AI-focused courses, badge-eligible)
 *   2. iGOT Marketplace Recommended (13 courses across strategy, leadership,
 *      policy, quantum, blockchain, cybersecurity, etc.)
 *
 * Each entry is mapped to a Saksham competency so the recommendations engine
 * can pick the right course for a given skill gap.
 */

export type IgotCourse = {
  id: string;
  title: string;
  provider: string;
  duration: string; // human-readable duration string from the PDF
  competency: string; // mapped Saksham competency (best-effort)
  track: "AI Daksh" | "Marketplace";
  language: "en" | "hi" | "both";
};

export const IGOT_COURSES: IgotCourse[] = [
  // ===== AI Daksh Program =====
  {
    id: "ai-daksh-1",
    title: "Artificial Intelligence for Public Governance",
    provider: "Kyndryl & Data Security Council of India",
    duration: "2h 42m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "en",
  },
  {
    id: "ai-daksh-2",
    title: "Large Language Models: Concepts and Applications",
    provider: "IIT Hyderabad",
    duration: "1h 31m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "en",
  },
  {
    id: "ai-daksh-3",
    title: "Deep Tech and India",
    provider: "ORF",
    duration: "53m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "en",
  },
  {
    id: "ai-daksh-4",
    title: "AI in Government: Transforming Public Service Delivery",
    provider: "Indian Institute of Science (IISc) Bengaluru",
    duration: "1h 16m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "en",
  },
  {
    id: "ai-daksh-5",
    title: "Artificial Intelligence for Karmayogis",
    provider: "Karmayogi Bharat - Fractal",
    duration: "1h 34m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "en",
  },
  {
    id: "ai-daksh-6",
    title: "YUVA AI for All",
    provider: "India AI Mission",
    duration: "3h 50m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "en",
  },
  {
    id: "ai-daksh-7",
    title: "Fundamentals of Generative Artificial Intelligence",
    provider: "IIT Madras",
    duration: "58m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "en",
  },
  {
    id: "ai-daksh-8",
    title: "Introduction to Artificial Intelligence",
    provider: "IIT Madras",
    duration: "1h 2m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "en",
  },
  {
    id: "ai-daksh-9",
    title: "AI Applications in Government",
    provider: "NeGD",
    duration: "1h 8m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "en",
  },
  {
    id: "ai-daksh-10",
    title: "आर्टिफ़िशियल इंटेलिजेंस की मूल बातें: सीखना, अनुप्रयोग और नैतिकता",
    provider: "Microsoft",
    duration: "1h 34m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "hi",
  },
  {
    id: "ai-daksh-11",
    title: "प्रशासन के लिए उत्तरदायी एआई का उपयोग",
    provider: "Wadhwani Foundation",
    duration: "44m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "hi",
  },
  {
    id: "ai-daksh-12",
    title: "सुशासन में एआई नैतिकता",
    provider: "Wadhwani Foundation",
    duration: "1h 13m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "hi",
  },
  {
    id: "ai-daksh-13",
    title: "Artificial Intelligence in Finance",
    provider: "XLRI",
    duration: "1h 44m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "en",
  },
  {
    id: "ai-daksh-14",
    title: "Core Areas of Artificial Intelligence",
    provider: "IIT Madras",
    duration: "45m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "en",
  },
  {
    id: "ai-daksh-15",
    title: "युवा एआई फॉर ऑल",
    provider: "India AI Mission",
    duration: "3h 50m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "hi",
  },
  {
    id: "ai-daksh-16",
    title: "Governing with Artificial Intelligence",
    provider: "Kyndryl",
    duration: "3h 48m",
    competency: "AI/ML",
    track: "AI Daksh",
    language: "en",
  },

  // ===== iGOT Marketplace Recommended =====
  {
    id: "mkt-1",
    title: "Strategy and Game Theory for Management",
    provider: "IIM, Ahmedabad",
    duration: "32h 42m",
    competency: "Project Management",
    track: "Marketplace",
    language: "en",
  },
  {
    id: "mkt-2",
    title: "Leadership Skills",
    provider: "IIM, Ahmedabad",
    duration: "46h 11m",
    competency: "Communication",
    track: "Marketplace",
    language: "en",
  },
  {
    id: "mkt-3",
    title: "Law, Governance, and Public Policy",
    provider: "O. P. Jindal Global University",
    duration: "18h 37m",
    competency: "Communication",
    track: "Marketplace",
    language: "en",
  },
  {
    id: "mkt-4",
    title: "Introduction to Quantum Information",
    provider: "Korea Advanced Institute of Science and Technology (KAIST)",
    duration: "10h 48m",
    competency: "AI/ML",
    track: "Marketplace",
    language: "en",
  },
  {
    id: "mkt-5",
    title: "Negotiation Fundamentals",
    provider: "ESSEC Business School",
    duration: "8h 39m",
    competency: "Communication",
    track: "Marketplace",
    language: "en",
  },
  {
    id: "mkt-6",
    title: "Analysis and Interpretation of Large-Scale Programs",
    provider: "Johns Hopkins University",
    duration: "21h 6m",
    competency: "Project Management",
    track: "Marketplace",
    language: "en",
  },
  {
    id: "mkt-7",
    title: "Build and Execute an Organisational AI Strategy",
    provider: "Coursera Instructor Network",
    duration: "5h 52m",
    competency: "AI/ML",
    track: "Marketplace",
    language: "en",
  },
  {
    id: "mkt-8",
    title: "Forest Carbon Credits and Initiatives",
    provider: "Michigan State University",
    duration: "6h",
    competency: "Data Quality Frameworks",
    track: "Marketplace",
    language: "en",
  },
  {
    id: "mkt-9",
    title: "Design Thinking and Predictive Analytics for Data Products",
    provider: "University of California San Diego",
    duration: "8h 25m",
    competency: "Data Visualization",
    track: "Marketplace",
    language: "en",
  },
  {
    id: "mkt-10",
    title: "Effective Engagement of Civil Society in Development",
    provider: "Erasmus University Rotterdam",
    duration: "13h 19m",
    competency: "Communication",
    track: "Marketplace",
    language: "en",
  },
  {
    id: "mkt-11",
    title: "Blockchain Platforms",
    provider: "University at Buffalo, The State University of New York",
    duration: "16h 16m",
    competency: "Cybersecurity",
    track: "Marketplace",
    language: "en",
  },
  {
    id: "mkt-12",
    title: "Trade and Investment: Evidence-based policies for development",
    provider: "Erasmus University, Rotterdam",
    duration: "17h 2m",
    competency: "Communication",
    track: "Marketplace",
    language: "en",
  },
  {
    id: "mkt-13",
    title: "Foundations of Cybersecurity",
    provider: "Google",
    duration: "10h 10m",
    competency: "Cybersecurity",
    track: "Marketplace",
    language: "en",
  },
];

export const AI_DAKSH_COURSES = IGOT_COURSES.filter((c) => c.track === "AI Daksh");
export const MARKETPLACE_COURSES = IGOT_COURSES.filter((c) => c.track === "Marketplace");
