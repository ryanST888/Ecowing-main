import { Language, WasteDataPoint, Severity } from './types';

export const TRANSLATIONS = {
  [Language.EN]: {
    appTitle: "EcoWing",
    navHome: "Home",
    navDashboard: "Dashboard",
    navMap: "Live Map",
    navReport: "Report Waste",
    navAbout: "About",
    heroTitle: "Mapping Coastal Waste with AI",
    heroSubtitle: "EcoWing uses AI-powered analytics and autonomous drone technology to transform coastal waste management. We automate detection and collection across diverse coastal terrains where manual labor is risky.",
    statsTotalReports: "Total Reports",
    statsCleaned: "Area Cleaned (m²)",
    statsHighRisk: "High Risk Zones",
    uploadTitle: "AI Waste Analysis",
    uploadDesc: "Upload a photo or video of coastal debris. Our model will analyze composition and severity.",
    uploadBtn: "Select Photo or Video",
    analyzing: "The model is analyzing media...",
    analysisResult: "Analysis Result",
    submitReport: "Submit Report",
    recentActivity: "Recent Activity",
    mapLegend: "Pollution Severity",
    mapInstructions: "Click on markers for details. Scroll to zoom.",
    footerText: "2026 EcoWing Copyright. Fly High to Keep Our Home Clean!",
    homeMissionTitle: "The Challenge",
    homeMissionDesc: "Hong Kong accumulates 130,000 tons of coastal waste annually. Manual collection is labor-intensive and dangerous on our 733km of complex, rocky coastlines.",
    homeTechTitle: "Our Solution: Drone Crew",
    homeTechDesc: "A coordinated fleet: Small agile drones with robotic claws for picking up waste on diverse terrains, and larger drones for storage and transport. Powered by YOLO AI.",
    homeAboutTitle: "The Team",
    homeAboutDesc: "A multidisciplinary powerhouse from CUHK, HKUST, CityU and MU. Click to meet the visionaries behind EcoWing.",

    // --- TEAM ROLES ---
    teamRoleCoFounder: "Co-Founder",
    teamRoleMarketing: "Marketing & Impact",
    teamRoleTech: "Tech Development",

    teamModalFooter: "Fly High to Keep Our Home Clean!",
    detectingLocation: "Detecting your location...",
    locationFound: "Location detected",
    locationError: "Could not detect location. Using default.",
    confirmSubmission: "Confirm & Submit to System",
    discardReport: "Discard Report",
    editLocation: "Edit Location",
    latitude: "Latitude",
    longitude: "Longitude",
    reviewTitle: "Review & Correct",
    reviewDesc: "Please review the AI analysis and correct the location if necessary before submitting.",
  },
  [Language.ZH]: {
    appTitle: "EcoWing",
    navHome: "首頁",
    navDashboard: "數據儀表板",
    navMap: "實時地圖",
    navReport: "舉報垃圾",
    navAbout: "關於我們",
    heroTitle: "AI 驅動海岸垃圾監測",
    heroSubtitle: "EcoWing 利用 AI 分析和自主無人機技術改革海岸垃圾管理。我們致力於在人工難以到達的複雜地形上，實現自動化的垃圾檢測與收集。",
    statsTotalReports: "總報告數",
    statsCleaned: "已清理面積 (m²)",
    statsHighRisk: "高風險區域",
    uploadTitle: "AI 智能分析",
    uploadDesc: "上傳海岸垃圾照片或影片，我們的模型將自動分析垃圾成分及污染程度。",
    uploadBtn: "選擇照片或影片",
    analyzing: "模型正在分析媒體...",
    analysisResult: "分析結果",
    submitReport: "提交報告",
    recentActivity: "近期動態",
    mapLegend: "污染嚴重程度",
    mapInstructions: "點擊標記查看詳情。滾動滑鼠縮放。",
    footerText: "2026 EcoWing Copyright. Fly High to Keep Our Home Clean!",
    homeMissionTitle: "面臨的挑戰",
    homeMissionDesc: "香港每年堆積 13 萬噸海岸垃圾。在長達 733 公里的複雜海岸線上，人工清理不僅成本高昂，且充滿危險。",
    homeTechTitle: "解決方案：無人機隊",
    homeTechDesc: "協同作戰：配備機械爪的小型無人機在復雜地形上靈活收集，大型無人機負責存儲運輸，全由 YOLO AI 驅動。",
    homeAboutTitle: "核心團隊",
    homeAboutDesc: "來自香港中文大學、科技大學、城市大學及都會大學的跨學科團隊。點擊認識我們。",

    // --- TEAM ROLES (ZH) ---
    teamRoleCoFounder: "聯合創始人",
    teamRoleMarketing: "市場營銷與影響力",
    teamRoleTech: "技術開發",

    teamModalFooter: "Fly High to Keep Our Home Clean!",
    detectingLocation: "正在偵測您的位置...",
    locationFound: "已獲取位置",
    locationError: "無法獲取位置，使用預設值。",
    confirmSubmission: "確認並提交至系統",
    discardReport: "捨棄報告",
    editLocation: "編輯位置",
    latitude: "緯度",
    longitude: "經度",
    reviewTitle: "審核與修正",
    reviewDesc: "提交前，請審核 AI 分析結果並在必要時修正位置資訊。",
  }
};

export const WASTE_CATEGORIES = ["Plastic", "Metal", "Glass", "Paper", "Fabric", "Rubber", "Wood", "Other"];

export const TEAM_MEMBERS = [
  {
    name: "Yanni Chan",
    roleKey: "teamRoleCoFounder",
    bioEN: "Computer Science (CUHK)\nInclusive Youth Entrepreneurship Support (UNDP)\nPassion to Make the World a Better Place:)",
    bioZH: "香港中文大學計算機科學系\nUNDP 包容性青年創業支持項目\n致力於讓世界變得更美好 :)"
  },
  {
    name: "David Wu",
    roleKey: "teamRoleCoFounder",
    bioEN: "Physics + AI (HKUST)\nEntrepreneur with 10+ tech project experiences",
    bioZH: "香港科技大學物理與人工智能系\n擁有 10+ 項科技項目開發經驗的創業者"
  },
  {
    name: "Shalisa Ho",
    roleKey: "teamRoleMarketing",
    bioEN: "Biological Sciences (CityU)\nMarketing & Impact Measurement",
    bioZH: "香港城市大學生物科學系\n市場營銷與影響力評估"
  },
  {
    name: "Ryan Szeto",
    roleKey: "teamRoleTech",
    bioEN: "Data Science (MU)\nTechnology Development",
    bioZH: "香港都會大學數據科學系\n技術開發"
  }
];

// Empty mock data as requested
export const MOCK_DATA_POINTS: WasteDataPoint[] = [];

// Updated to Green (Emerald) and Yellow (Amber) theme
export const COLORS = {
  primary: '#10b981', // Emerald 500 (Primary Green)
  secondary: '#facc15', // Yellow 400
  accent: '#fbbf24', // Amber 400
  danger: '#ef4444', // Red 500
  success: '#10b981', // Emerald 500
  dark: '#0f172a', // Slate 900
  card: '#1e293b', // Slate 800
};