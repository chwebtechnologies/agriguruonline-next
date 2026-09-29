const fs = require("fs");
let content = fs.readFileSync("components/layout/AppMenu.tsx", "utf8");
content = content.replace("profile?: any;", "profile?: any;\n  dict?: any;");
content = content.replace("}: AppMenuProps)", ", dict }: AppMenuProps)");

const replacements = [
  ["Logout", "{dict?.header?.logout || 'Logout'}"],
  ["Login", "{dict?.header?.login || 'Login'}"],
  ["Home", "{dict?.header?.home_menu || 'Home'}"],
  ["Light Mode", "{dict?.header?.light_mode || 'Light Mode'}"],
  ["Dark Mode", "{dict?.header?.dark_mode || 'Dark Mode'}"],
  ["Upgrade Plan", "{dict?.common?.upgrade_plan || 'Upgrade Plan'}"],
  ["Membership Plan", "{dict?.common?.membership_plan || 'Membership Plan'}"],
  ["Dashboard", "dict?.header?.dashboard || 'Dashboard'"],
  ["My Inquiries", "dict?.header?.my_inquiries || 'My Inquiries'"],
  ["My Offers", "dict?.header?.my_offers || 'My Offers'"],
  ["Product Charts", "dict?.header?.product_charts || 'Product Charts'"],
  ["Freight Charts", "dict?.header?.freight_charts || 'Freight Charts'"],
  ["Alerts Setups", "dict?.header?.alerts || 'Alerts Setups'"],
  ["AI Predicts", "dict?.header?.ai_predicts || 'AI Predicts'"],
  ["Smart Docs", "dict?.header?.smart_docs || 'Smart Docs'"],
  ["Instructions", "dict?.header?.instructions || 'Instructions'"],
  ["Market Reports", "dict?.header?.market_reports || 'Market Reports'"],
  ["Messages", "dict?.header?.messages || 'Messages'"],
  ["My Settings", "dict?.header?.my_settings || 'My Settings'"],
  ["My Profile", "dict?.header?.my_profile || 'My Profile'"]
];

replacements.forEach(([from, to]) => {
  if (["Logout", "Login", "Home", "Light Mode", "Dark Mode", "Upgrade Plan", "Membership Plan"].includes(from)) {
    // For text in tags
    const r = new RegExp(`>(${from})<`, "g");
    content = content.replace(r, `>${to}<`);
  } else {
    // For strings in the MENU_GROUPS array
    const r = new RegExp(`label:\\s*'${from}'`, "g");
    content = content.replace(r, `label: ${to}`);
  }
});
fs.writeFileSync("components/layout/AppMenu.tsx", content);
