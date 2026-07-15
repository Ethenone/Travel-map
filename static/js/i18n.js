/* ============================================================
   Bilingual (EN / 中文) loader & toggle for resume.html
   ------------------------------------------------------------
   工作方式：
   - 英文内容沿用你现有的文件：
       config.yml, home.md, awards.md, experience.md,
       publications.md, skills.md
   - 中文内容放在新增的文件中：
       config.zh.yml, home.zh.md, awards.zh.md,
       experience.zh.md, publications.zh.md, skills.zh.md
   - 把中文文件放在和英文文件「同一个目录」里。
   - 如果你的内容文件不在 resume.html 同级目录，请修改下面的 CONTENT_DIR。
   ============================================================ */

(function () {
  "use strict";

  // ★ 如果你的 .md / .yml 文件不在 resume.html 同级目录，请改这里。
  //   例如放在 markdown/ 文件夹下，就写成 "markdown/"
  const CONTENT_DIR = "contents/";

  const FILES = {
    en: {
      config: "config.yml",
      home: "home.md",
      awards: "awards.md",
      experience: "experience.md",
      publications: "publications.md",
      skills: "skills.md",
    },
    zh: {
      config: "config.zh.yml",
      home: "home.zh.md",
      awards: "awards.zh.md",
      experience: "experience.zh.md",
      publications: "publications.zh.md",
      skills: "skills.zh.md",
    },
  };

  // 页面里写死在 HTML 中的文字（导航栏、各区块标题、页面标题等）
  const UI = {
    en: {
      docTitle: "Resume",
      toggleLabel: "中文",
      printLabel: "Print",
      nav: { home: "HOME", awards: "AWARDS", experience: "EXPERIENCE", publications: "PUBLICATIONS" },
      subtitles: {
        awards: '<i class="bi bi-award-fill"></i>AWARDS ',
        experience: '<i class="bi bi-briefcase-fill"></i> EXPERIENCE ',
        publications: '<i class="bi bi-file-text-fill"></i>&nbsp;PUBLICATIONS',
        skills: '<i class="bi bi-file-text-fill"></i>&nbsp;SKILLS',
        projects: '<i class="bi bi-file-text-fill"></i>&nbsp;PROJECTS',
      },
      github: "Github",
      license: "License",
    },
    zh: {
      docTitle: "简历",
      toggleLabel: "EN",
      printLabel: "打印",
      nav: { home: "主页", awards: "奖项", experience: "经历", publications: "论文成果" },
      subtitles: {
        awards: '<i class="bi bi-award-fill"></i>奖项 ',
        experience: '<i class="bi bi-briefcase-fill"></i> 经历 ',
        publications: '<i class="bi bi-file-text-fill"></i>&nbsp;论文成果',
        skills: '<i class="bi bi-file-text-fill"></i>&nbsp;技能',
        projects: '<i class="bi bi-file-text-fill"></i>&nbsp;项目',
      },
      github: "Github",
      license: "开源协议",
    },
  };

  const STORAGE_KEY = "resume-lang";

  function getLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === "en" || saved === "zh") return saved;
    } catch (e) { /* localStorage 不可用时忽略 */ }
    // 首次访问：根据浏览器语言猜测
    return (navigator.language || "").toLowerCase().indexOf("zh") === 0 ? "zh" : "en";
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }
  function setHTML(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = value;
  }

  function renderMarkdown(text) {
    if (window.marked) {
      return typeof marked.parse === "function" ? marked.parse(text) : marked(text);
    }
    return text;
  }

  async function fetchText(path) {
    const res = await fetch(path, { cache: "no-cache" });
    if (!res.ok) throw new Error("Failed to load " + path + " (" + res.status + ")");
    return res.text();
  }

  async function loadConfig(file) {
    try {
      const text = await fetchText(CONTENT_DIR + file);
      const cfg = window.jsyaml ? jsyaml.load(text) : null;
      if (!cfg) return;
      if (cfg["page-top-title"] != null) setHTML("page-top-title", cfg["page-top-title"]);
      if (cfg["top-section-bg-text"] != null) setHTML("top-section-bg-text", cfg["top-section-bg-text"]);
      if (cfg["home-subtitle"] != null) setHTML("home-subtitle", cfg["home-subtitle"]);
      if (cfg["copyright-text"] != null) setHTML("copyright-text", cfg["copyright-text"]);
    } catch (e) {
      console.error("[i18n] config error:", e);
    }
  }

  async function loadSection(file, targetId) {
    try {
      const text = await fetchText(CONTENT_DIR + file);
      setHTML(targetId, renderMarkdown(text));
    } catch (e) {
      console.error("[i18n] section error (" + targetId + "):", e);
    }
  }

  async function applyLang(lang) {
    const ui = UI[lang];
    const files = FILES[lang];

    document.documentElement.setAttribute("lang", lang === "zh" ? "zh-CN" : "en");

    // 写死在 HTML 里的文字
    setText("title", ui.docTitle);
    document.title = ui.docTitle;
    setText("nav-home", ui.nav.home);
    setText("nav-awards", ui.nav.awards);
    setText("nav-experience", ui.nav.experience);
    setText("nav-publications", ui.nav.publications);
    setHTML("awards-subtitle", ui.subtitles.awards);
    setHTML("experience-subtitle", ui.subtitles.experience);
    setHTML("publications-subtitle", ui.subtitles.publications);
    setHTML("skills-subtitle", ui.subtitles.skills);
    setHTML("projects-subtitle", ui.subtitles.projects);
    setText("github-link", ui.github);
    setText("license-link", ui.license);

    const toggle = document.getElementById("lang-toggle");
    if (toggle) toggle.textContent = ui.toggleLabel;

    const printBtn = document.getElementById("print-btn");
    if (printBtn) printBtn.textContent = ui.printLabel;

    // 从文件加载内容
    await Promise.all([
      loadConfig(files.config),
      loadSection(files.home, "home-md"),
      loadSection(files.awards, "awards-md"),
      loadSection(files.experience, "experience-md"),
      loadSection(files.publications, "publications-md"),
      loadSection(files.skills, "skills-md"),
    ]);

    // MathJax 重新排版（如果存在公式）
    if (window.MathJax && typeof MathJax.typesetPromise === "function") {
      MathJax.typesetPromise().catch(function () {});
    }
  }

  let currentLang = getLang();

  function toggleLang() {
    currentLang = currentLang === "en" ? "zh" : "en";
    try { localStorage.setItem(STORAGE_KEY, currentLang); } catch (e) {}
    applyLang(currentLang);
  }

  function init() {
    const toggle = document.getElementById("lang-toggle");
    if (toggle) {
      toggle.addEventListener("click", function (e) {
        e.preventDefault();
        toggleLang();
      });
    }
    applyLang(currentLang);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  // 页面完全加载后再应用一次，确保覆盖原始 scripts.js 的默认加载结果。
  window.addEventListener("load", function () { applyLang(currentLang); });
})();
