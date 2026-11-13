/**
 * ─────────────────────────────────────────────────────────────
 *  ตั้งค่าเว็บไซต์ / SITE CONFIG
 *  แก้ไฟล์นี้เพื่อใส่ชื่อ รูป และลิงก์โซเชียลของคุณ
 * ─────────────────────────────────────────────────────────────
 */
window.SITE_CONFIG = {
  owner: {
    name: "ชื่อของคุณ",
    handle: "@yourhandle",
    tagline: "รวบรวมและเรียบเรียงคำตอบ เพื่อช่วยให้การฝึกภาษาง่ายขึ้น",
    // วางรูปโปรไฟล์ของคุณที่  assets/profile.jpg  แล้วเปิดเว็บใหม่
    // (ถ้าไม่มีไฟล์ ระบบจะใช้ assets/profile.svg แทนให้อัตโนมัติ)
    photo: "assets/profile.jpg",
    fallbackPhoto: "assets/profile.svg",
    initials: "ME",
  },

  credit: {
    // true = แสดงป๊อปอัปเครดิตทุกครั้งที่เปิดเว็บ
    showOnLoad: true,
    kicker: "CRAFTED WITH CARE",
    title: "ขอบคุณที่แวะมา",
    note:
      "คลังคำตอบนี้จัดทำขึ้นเพื่อใช้ทบทวนและฝึกภาษาอังกฤษเท่านั้น " +
      "คำตอบทั้งหมดรวบรวมจากไฟล์ข้อมูลในเครื่องของคุณ",
  },

  socials: [
    {
      label: "Facebook",
      handle: "facebook.com/yourprofile",
      url: "https://www.facebook.com/",
      icon: "facebook",
    },
    {
      label: "Instagram",
      handle: "@yourhandle",
      url: "https://www.instagram.com/",
      icon: "instagram",
    },
    // เพิ่มลิงก์อื่นได้ เช่น
    // { label: "GitHub", handle: "@yourname", url: "https://github.com/yourname", icon: "github" },
  ],
};
