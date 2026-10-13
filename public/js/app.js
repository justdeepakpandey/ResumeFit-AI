/**
 * ResumeFit AI — Frontend Application
 * public/js/app.js
 *
 * Handles:
 *  - File drag-and-drop upload
 *  - Form validation and submission
 *  - API communication
 *  - Result rendering (score ring, badges, cards)
 *  - Analysis history panel
 *  - Notifications
 */

'use strict';

/* ──────────────────────────────────────────────────────────
   Centralized API Configuration
────────────────────────────────────────────────────────── */
const API_CONFIG = {
  // Production Render backend base URL
  productionBase: 'https://resumefit-ai-sfk4.onrender.com/api',
  // Local development backend fallback
  localBase: '/api',

  /**
   * Resolves the API base URL depending on runtime environment.
   * - In production (e.g. deployed on Vercel), points to the deployed Render backend:
   *   https://resumefit-ai-sfk4.onrender.com/api
   * - In local development (localhost / 127.0.0.1 / file:), points to local /api
   * - Can be overridden at runtime via window.API_BASE or window.RESUMEFIT_API_URL
   */
  resolveBase() {
    if (typeof window !== 'undefined') {
      // 1. Explicit manual override
      if (window.API_BASE && typeof window.API_BASE === 'string') {
        return window.API_BASE.trim().replace(/\/+$/, '');
      }
      if (window.RESUMEFIT_API_URL && typeof window.RESUMEFIT_API_URL === 'string') {
        return window.RESUMEFIT_API_URL.trim().replace(/\/+$/, '');
      }

      // 2. Check environment based on hostname
      const hostname = window.location.hostname || '';
      const isLocalhost =
        hostname === 'localhost' ||
        hostname === '127.0.0.1' ||
        hostname === '0.0.0.0' ||
        hostname.endsWith('.local') ||
        window.location.protocol === 'file:';

      if (isLocalhost) {
        const port = window.location.port;
        // If loaded from a different local dev server port (e.g. 5500, 8080), route to Express on 3000
        if (port && port !== '3000' && window.location.protocol !== 'file:') {
          return 'http://localhost:3000/api';
        }
        return this.localBase;
      }
    }

    // 3. Deployed production on Vercel or any remote domain
    return this.productionBase;
  },
};

const API_BASE = API_CONFIG.resolveBase();
const MAX_FILE_SIZE_MB = 5;

const state = {
  selectedFile: null,
  currentReport: null,
  isLoading: false,
  currentUser: null,
  authToken:
    typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('resumefit_token')
      : null,
};

function getAuthHeaders(extraHeaders = {}) {
  const headers = { ...extraHeaders };
  const token =
    state.authToken ||
    (typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('resumefit_token')
      : null);
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

/* ──────────────────────────────────────────────────────────
   DOM References
────────────────────────────────────────────────────────── */
const $ = (id) => document.getElementById(id);
const els = {
  dropZone:           $('dropZone'),
  resumeFile:         $('resumeFile'),
  dropIcon:           $('dropIcon'),
  dropTitle:          $('dropTitle'),
  dropSubtitle:       $('dropSubtitle'),
  dropFileName:       $('dropFileName'),
  jobDescription:     $('jobDescription'),
  jobTitle:           $('jobTitle'),
  companyName:        $('companyName'),
  progressWrap:       $('progressWrap'),
  progressBar:        $('progressBar'),
  analyzeBtn:         $('analyzeBtn'),
  resetBtn:           $('resetBtn'),
  historyList:        $('historyList'),
  emptyState:         $('emptyState'),
  resultsContent:     $('resultsContent'),
  statusDot:          $('statusDot'),
  statusText:         $('statusText'),
  notifications:      $('notifications'),

  // Score hero
  scoreNumber:        $('scoreNumber'),
  scoreTitle:         $('scoreTitle'),
  scoreSubtitle:      $('scoreSubtitle'),
  scoreRing:          $('scoreRing'),
  barSkills:          $('barSkills'),
  barExp:             $('barExp'),
  barProjects:        $('barProjects'),
  valSkills:          $('valSkills'),
  valExp:             $('valExp'),
  valProjects:        $('valProjects'),
  metaRequired:       $('metaRequired'),
  metaPreferred:      $('metaPreferred'),

  // Cards
  assessmentText:     $('assessmentText'),
  matchedSkillsList:  $('matchedSkillsList'),
  missingRequiredList:$('missingRequiredList'),
  missingPreferredList:$('missingPreferredList'),
  expSummary:         $('expSummary'),
  expHighlights:      $('expHighlights'),
  expPill:            $('expPill'),
  eduSummary:         $('eduSummary'),
  eduPill:            $('eduPill'),
  projSummary:        $('projSummary'),
  projList:           $('projList'),
  projPill:           $('projPill'),
  keywordCloud:       $('keywordCloud'),
  suggestionList:     $('suggestionList'),
  strengthsList:      $('strengthsList'),
  gapsList:           $('gapsList'),

  // Nav controls
  navDashboardBtn:      $('navDashboardBtn'),
  navHistoryBtn:        $('navHistoryBtn'),
  navHelpBtn:           $('navHelpBtn'),
  navAboutBtn:          $('navAboutBtn'),

  // Footer controls
  footerAboutBtn:       $('footerAboutBtn'),
  footerHelpBtn:        $('footerHelpBtn'),

  // Guest & Auth Header DOM elements
  guestBadge:           $('guestBadge'),
  guestLogoutBtn:       $('guestLogoutBtn'),
  openLoginBtn:         $('openLoginBtn'),
  openSignupBtn:        $('openSignupBtn'),
  loggedOutNav:         $('loggedOutNav'),
  userProfileNav:       $('userProfileNav'),
  userAvatar:           $('userAvatar'),
  userName:             $('userName'),
  logoutBtn:            $('logoutBtn'),

  // History Card
  historyHeadingText:   $('historyHeadingText'),
  historyBadge:         $('historyBadge'),
  guestHistoryNotice:   $('guestHistoryNotice'),
  guestNoticeLoginBtn:  $('guestNoticeLoginBtn'),
  guestNoticeSignupBtn: $('guestNoticeSignupBtn'),
  historyEmptyMsg:      $('historyEmptyMsg'),

  // Auth Modal
  authModal:            $('authModal'),
  closeAuthModalBtn:    $('closeAuthModalBtn'),
  tabLoginBtn:          $('tabLoginBtn'),
  tabSignupBtn:         $('tabSignupBtn'),
  authAlert:            $('authAlert'),

  loginForm:            $('loginForm'),
  loginEmail:           $('loginEmail'),
  loginPassword:        $('loginPassword'),
  loginSubmitBtn:       $('loginSubmitBtn'),
  switchToSignup:       $('switchToSignup'),

  signupForm:           $('signupForm'),
  signupName:           $('signupName'),
  signupEmail:          $('signupEmail'),
  signupPassword:       $('signupPassword'),
  signupConfirmPassword:$('signupConfirmPassword'),
  signupSubmitBtn:      $('signupSubmitBtn'),
  switchToLogin:        $('switchToLogin'),

  // About Modal
  aboutModal:           $('aboutModal'),
  closeAboutModalBtn:   $('closeAboutModalBtn'),
  backFromAboutBtn:     $('backFromAboutBtn'),

  // Help Modal
  helpModal:            $('helpModal'),
  closeHelpModalBtn:    $('closeHelpModalBtn'),
  backFromHelpBtn:      $('backFromHelpBtn'),
  tabHelpGuideBtn:      $('tabHelpGuideBtn'),
  tabHelpFaqBtn:        $('tabHelpFaqBtn'),
  tabHelpFeedbackBtn:   $('tabHelpFeedbackBtn'),
  helpGuideSection:     $('helpGuideSection'),
  helpFaqSection:       $('helpFaqSection'),
  helpFeedbackSection:  $('helpFeedbackSection'),

  // Feedback Form
  feedbackForm:         $('feedbackForm'),
  feedbackType:         $('feedbackType'),
  feedbackSubject:      $('feedbackSubject'),
  feedbackMessage:      $('feedbackMessage'),
  feedbackSubmitBtn:    $('feedbackSubmitBtn'),
  feedbackAlert:        $('feedbackAlert'),
};

/* ──────────────────────────────────────────────────────────
   Initialisation
────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', async () => {
  await checkAuthSession();
  checkHealth();
  bindEvents();
});

/* ──────────────────────────────────────────────────────────
   Auth Session & Modal Handlers
────────────────────────────────────────────────────────── */
async function checkAuthSession() {
  try {
    const token =
      typeof sessionStorage !== 'undefined'
        ? sessionStorage.getItem('resumefit_token')
        : null;
    if (token) state.authToken = token;

    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success && data.user) {
        state.currentUser = data.user;
      }
    } else if (res.status === 401) {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem('resumefit_token');
      }
      state.authToken = null;
      state.currentUser = null;
    }
  } catch {
    // guest mode default
  }
  renderAuthState();
  if (state.currentUser) {
    loadHistory();
  }
}

function renderAuthState() {
  if (state.currentUser) {
    // Authenticated Mode
    if (els.loggedOutNav) els.loggedOutNav.classList.add('hidden');
    if (els.userProfileNav) els.userProfileNav.classList.remove('hidden');
    if (els.userName) els.userName.textContent = state.currentUser.name || state.currentUser.email;

    // History card: show saved history list, hide guest notice
    if (els.guestHistoryNotice) els.guestHistoryNotice.classList.add('hidden');
    if (els.historyList) els.historyList.classList.remove('hidden');
    if (els.historyHeadingText) els.historyHeadingText.textContent = 'My History';
    if (els.historyBadge) {
      els.historyBadge.textContent = 'Saved Reports';
      els.historyBadge.style.color = 'var(--green)';
    }
  } else {
    // Guest Mode (Default)
    if (els.loggedOutNav) els.loggedOutNav.classList.remove('hidden');
    if (els.userProfileNav) els.userProfileNav.classList.add('hidden');

    // History card: show guest notice explaining no persistence, hide history list
    if (els.guestHistoryNotice) els.guestHistoryNotice.classList.remove('hidden');
    if (els.historyList) els.historyList.classList.add('hidden');
    if (els.historyHeadingText) els.historyHeadingText.textContent = 'My History';
    if (els.historyBadge) {
      els.historyBadge.textContent = 'Guest Mode';
      els.historyBadge.style.color = 'var(--cyan)';
    }
  }
}

function openAuthModal(mode = 'login') {
  if (!els.authModal) return;
  hideAuthAlert();
  els.authModal.classList.remove('hidden');
  switchAuthTab(mode);
}

function closeAuthModal() {
  if (!els.authModal) return;
  els.authModal.classList.add('hidden');
  hideAuthAlert();
}

function switchAuthTab(mode) {
  hideAuthAlert();
  if (mode === 'login') {
    els.tabLoginBtn.classList.add('active');
    els.tabSignupBtn.classList.remove('active');
    els.loginForm.classList.remove('hidden');
    els.signupForm.classList.add('hidden');
  } else {
    els.tabSignupBtn.classList.add('active');
    els.tabLoginBtn.classList.remove('active');
    els.signupForm.classList.remove('hidden');
    els.loginForm.classList.add('hidden');
  }
}

function showAuthAlert(msg) {
  if (!els.authAlert) return;
  els.authAlert.textContent = msg;
  els.authAlert.classList.remove('hidden');
}

function hideAuthAlert() {
  if (!els.authAlert) return;
  els.authAlert.classList.add('hidden');
  els.authAlert.textContent = '';
}

async function handleLogin(e) {
  e.preventDefault();
  hideAuthAlert();

  const email = els.loginEmail.value.trim();
  const password = els.loginPassword.value;

  if (!email || !password) {
    showAuthAlert('Please fill in both email and password.');
    return;
  }

  els.loginSubmitBtn.disabled = true;
  els.loginSubmitBtn.querySelector('.btn-text').textContent = 'Logging in…';

  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showAuthAlert(data.error || (data.errors && data.errors.join(' ')) || 'Login failed.');
      return;
    }

    state.currentUser = data.user;
    if (data.token) {
      state.authToken = data.token;
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('resumefit_token', data.token);
      }
    }
    renderAuthState();
    closeAuthModal();
    showNotification('success', 'Logged In', `Welcome back, ${data.user.name}!`);
    loadHistory();
  } catch (err) {
    showAuthAlert(err.message || 'Login request failed.');
  } finally {
    els.loginSubmitBtn.disabled = false;
    els.loginSubmitBtn.querySelector('.btn-text').textContent = 'Log In';
  }
}

async function handleSignup(e) {
  e.preventDefault();
  hideAuthAlert();

  const name = els.signupName.value.trim();
  const email = els.signupEmail.value.trim();
  const password = els.signupPassword.value;
  const confirmPassword = els.signupConfirmPassword.value;

  if (!name || !email || !password || !confirmPassword) {
    showAuthAlert('Please fill in all required fields.');
    return;
  }

  if (password.length < 6) {
    showAuthAlert('Password must be at least 6 characters.');
    return;
  }

  if (password !== confirmPassword) {
    showAuthAlert('Passwords do not match.');
    return;
  }

  els.signupSubmitBtn.disabled = true;
  els.signupSubmitBtn.querySelector('.btn-text').textContent = 'Creating account…';

  try {
    const res = await fetch(`${API_BASE}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name, email, password, confirmPassword }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      showAuthAlert(data.error || (data.errors && data.errors.join(' ')) || 'Signup failed.');
      return;
    }

    state.currentUser = data.user;
    if (data.token) {
      state.authToken = data.token;
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('resumefit_token', data.token);
      }
    }
    renderAuthState();
    closeAuthModal();
    showNotification('success', 'Account Created', `Welcome to ResumeFit AI, ${data.user.name}!`);
    loadHistory();
  } catch (err) {
    showAuthAlert(err.message || 'Signup request failed.');
  } finally {
    els.signupSubmitBtn.disabled = false;
    els.signupSubmitBtn.querySelector('.btn-text').textContent = 'Sign Up';
  }
}

async function handleLogout() {
  try {
    await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
  } catch (_e) {
    // ignore network error
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('resumefit_token');
  }
  state.authToken = null;
  state.currentUser = null;
  resetForm();
  renderAuthState();
  showNotification('info', 'Logged Out', 'You have been logged out. Operating in Guest Mode.');
}

function handleGuestLogout() {
  // Clear in-memory resume data and analysis results
  resetForm();
  state.selectedFile = null;
  state.currentReport = null;
  renderAuthState();
  showNotification('info', 'Guest Session Reset', 'Guest state cleared. You are on a fresh Guest Mode dashboard.');
}

/* ──────────────────────────────────────────────────────────
   About Modal Handlers
────────────────────────────────────────────────────────── */
function openAboutModal() {
  if (!els.aboutModal) return;
  els.aboutModal.classList.remove('hidden');
}

function closeAboutModal() {
  if (!els.aboutModal) return;
  els.aboutModal.classList.add('hidden');
}

/* ──────────────────────────────────────────────────────────
   Help Modal & Tabs Handlers
────────────────────────────────────────────────────────── */
function openHelpModal(tab = 'guide') {
  if (!els.helpModal) return;
  els.helpModal.classList.remove('hidden');
  switchHelpTab(tab);
}

function closeHelpModal() {
  if (!els.helpModal) return;
  els.helpModal.classList.add('hidden');
  hideFeedbackAlert();
}

function switchHelpTab(tab) {
  const tabs = {
    guide:    { btn: els.tabHelpGuideBtn, sec: els.helpGuideSection },
    faq:      { btn: els.tabHelpFaqBtn, sec: els.helpFaqSection },
    feedback: { btn: els.tabHelpFeedbackBtn, sec: els.helpFeedbackSection },
  };

  Object.entries(tabs).forEach(([k, { btn, sec }]) => {
    if (k === tab) {
      if (btn) btn.classList.add('active');
      if (sec) sec.classList.remove('hidden');
    } else {
      if (btn) btn.classList.remove('active');
      if (sec) sec.classList.add('hidden');
    }
  });
}

function bindFaqAccordion() {
  const faqItems = document.querySelectorAll('#faqAccordion .faq-item');
  faqItems.forEach((item) => {
    const btn = item.querySelector('.faq-question');
    if (!btn) return;
    btn.addEventListener('click', () => {
      const isOpen = item.classList.contains('faq-open');
      // Close other items for a clean accordion experience
      faqItems.forEach((other) => {
        if (other !== item) {
          other.classList.remove('faq-open');
          const otherBtn = other.querySelector('.faq-question');
          if (otherBtn) otherBtn.setAttribute('aria-expanded', 'false');
        }
      });
      item.classList.toggle('faq-open', !isOpen);
      btn.setAttribute('aria-expanded', !isOpen ? 'true' : 'false');
    });
  });
}

/* ──────────────────────────────────────────────────────────
   Feedback Form Handlers
────────────────────────────────────────────────────────── */
async function handleFeedbackSubmit(e) {
  e.preventDefault();
  hideFeedbackAlert();

  const type = els.feedbackType ? els.feedbackType.value : 'Suggestion';
  const subject = els.feedbackSubject ? els.feedbackSubject.value.trim() : '';
  const message = els.feedbackMessage ? els.feedbackMessage.value.trim() : '';

  if (!message || message.length < 5) {
    showFeedbackAlert('error', 'Please provide a message of at least 5 characters.');
    return;
  }

  els.feedbackSubmitBtn.disabled = true;
  els.feedbackSubmitBtn.classList.add('loading');
  const btnText = els.feedbackSubmitBtn.querySelector('.btn-text');
  if (btnText) btnText.textContent = 'Submitting…';

  try {
    const res = await fetch(`${API_BASE}/feedback`, {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ type, subject, message }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      const errMsg = data.errors ? data.errors.join(' ') : (data.error || 'Failed to submit feedback.');
      throw new Error(errMsg);
    }

    showFeedbackAlert('success', data.message || 'Thank you for your feedback! It has been recorded successfully.');
    if (els.feedbackMessage) els.feedbackMessage.value = '';
    if (els.feedbackSubject) els.feedbackSubject.value = '';
    showNotification('success', 'Feedback Submitted', 'Thank you! Your feedback has been received and saved.');
  } catch (err) {
    showFeedbackAlert('error', err.message || 'Feedback submission failed.');
  } finally {
    els.feedbackSubmitBtn.disabled = false;
    els.feedbackSubmitBtn.classList.remove('loading');
    if (btnText) btnText.textContent = 'Submit Feedback';
  }
}

function showFeedbackAlert(type, msg) {
  if (!els.feedbackAlert) return;
  els.feedbackAlert.className = `feedback-alert ${type}`;
  els.feedbackAlert.textContent = msg;
  els.feedbackAlert.classList.remove('hidden');
}

function hideFeedbackAlert() {
  if (!els.feedbackAlert) return;
  els.feedbackAlert.className = 'feedback-alert hidden';
  els.feedbackAlert.textContent = '';
}

/* ──────────────────────────────────────────────────────────
   Health Check
────────────────────────────────────────────────────────── */
async function checkHealth() {
  setStatus('checking', 'Checking…');
  try {
    const res = await fetch(`${API_BASE}/health`);
    const data = await res.json();
    if (data.status === 'ok') {
      setStatus('online', 'API Online');
    } else {
      setStatus('error', 'DB Offline');
      showNotification('warning', 'Database Unavailable',
        'MySQL is not connected. History will not be saved. Analysis may still work.');
    }
  } catch {
    setStatus('error', 'API Offline');
    showNotification('error', 'Server Unreachable',
      'Could not connect to the ResumeFit AI server. Make sure it is running.');
  }
}

function setStatus(type, text) {
  els.statusDot.className = `status-dot ${type}`;
  els.statusText.textContent = text;
}

/* ──────────────────────────────────────────────────────────
   Event Bindings
────────────────────────────────────────────────────────── */
function bindEvents() {
  // File input change
  els.resumeFile.addEventListener('change', (e) => {
    handleFileSelect(e.target.files[0]);
  });

  // Drop zone keyboard accessibility
  els.dropZone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      els.resumeFile.click();
    }
  });

  // Drag events
  els.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    els.dropZone.classList.add('dragover');
  });

  els.dropZone.addEventListener('dragleave', (e) => {
    if (!els.dropZone.contains(e.relatedTarget)) {
      els.dropZone.classList.remove('dragover');
    }
  });

  els.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    els.dropZone.classList.remove('dragover');
    const file = e.dataTransfer?.files[0];
    if (file) handleFileSelect(file);
  });

  // Analyze
  els.analyzeBtn.addEventListener('click', handleAnalyze);

  // Reset
  els.resetBtn.addEventListener('click', resetForm);

  // Nav Links
  if (els.navDashboardBtn) {
    els.navDashboardBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if (els.navHistoryBtn) {
    els.navHistoryBtn.addEventListener('click', () => {
      if (state.currentUser) {
        document.getElementById('historyCard').scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        showNotification('info', 'My History', 'Analysis history requires an account. Log in or sign up to save your analyses.');
        openAuthModal('login');
      }
    });
  }

  if (els.navHelpBtn) els.navHelpBtn.addEventListener('click', () => openHelpModal('guide'));
  if (els.navAboutBtn) els.navAboutBtn.addEventListener('click', openAboutModal);

  // Footer Links
  if (els.footerAboutBtn) els.footerAboutBtn.addEventListener('click', openAboutModal);
  if (els.footerHelpBtn) els.footerHelpBtn.addEventListener('click', () => openHelpModal('guide'));

  // Guest Controls
  if (els.guestLogoutBtn) els.guestLogoutBtn.addEventListener('click', handleGuestLogout);
  if (els.guestNoticeLoginBtn) els.guestNoticeLoginBtn.addEventListener('click', () => openAuthModal('login'));
  if (els.guestNoticeSignupBtn) els.guestNoticeSignupBtn.addEventListener('click', () => openAuthModal('signup'));

  // Auth Modal & Nav Controls
  if (els.openLoginBtn) els.openLoginBtn.addEventListener('click', () => openAuthModal('login'));
  if (els.openSignupBtn) els.openSignupBtn.addEventListener('click', () => openAuthModal('signup'));
  if (els.closeAuthModalBtn) els.closeAuthModalBtn.addEventListener('click', closeAuthModal);
  if (els.tabLoginBtn) els.tabLoginBtn.addEventListener('click', () => switchAuthTab('login'));
  if (els.tabSignupBtn) els.tabSignupBtn.addEventListener('click', () => switchAuthTab('signup'));
  if (els.switchToSignup) els.switchToSignup.addEventListener('click', (e) => { e.preventDefault(); switchAuthTab('signup'); });
  if (els.switchToLogin) els.switchToLogin.addEventListener('click', (e) => { e.preventDefault(); switchAuthTab('login'); });
  if (els.loginForm) els.loginForm.addEventListener('submit', handleLogin);
  if (els.signupForm) els.signupForm.addEventListener('submit', handleSignup);
  if (els.logoutBtn) els.logoutBtn.addEventListener('click', handleLogout);

  // About Modal Controls
  if (els.closeAboutModalBtn) els.closeAboutModalBtn.addEventListener('click', closeAboutModal);
  if (els.backFromAboutBtn) els.backFromAboutBtn.addEventListener('click', closeAboutModal);

  // Help Modal Controls
  if (els.closeHelpModalBtn) els.closeHelpModalBtn.addEventListener('click', closeHelpModal);
  if (els.backFromHelpBtn) els.backFromHelpBtn.addEventListener('click', closeHelpModal);
  if (els.tabHelpGuideBtn) els.tabHelpGuideBtn.addEventListener('click', () => switchHelpTab('guide'));
  if (els.tabHelpFaqBtn) els.tabHelpFaqBtn.addEventListener('click', () => switchHelpTab('faq'));
  if (els.tabHelpFeedbackBtn) els.tabHelpFeedbackBtn.addEventListener('click', () => switchHelpTab('feedback'));

  // FAQ Accordion
  bindFaqAccordion();

  // Feedback Form
  if (els.feedbackForm) els.feedbackForm.addEventListener('submit', handleFeedbackSubmit);

  // Modal Backdrop dismissals
  if (els.authModal) {
    els.authModal.addEventListener('click', (e) => {
      if (e.target === els.authModal) closeAuthModal();
    });
  }

  if (els.aboutModal) {
    els.aboutModal.addEventListener('click', (e) => {
      if (e.target === els.aboutModal) closeAboutModal();
    });
  }

  if (els.helpModal) {
    els.helpModal.addEventListener('click', (e) => {
      if (e.target === els.helpModal) closeHelpModal();
    });
  }

  // Escape key closes open modals
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeAuthModal();
      closeAboutModal();
      closeHelpModal();
    }
  });
}

/* ──────────────────────────────────────────────────────────
   File Handling
────────────────────────────────────────────────────────── */
function handleFileSelect(file) {
  if (!file) return;

  // Client-side validation
  const ext = file.name.split('.').pop().toLowerCase();
  if (!['pdf', 'docx'].includes(ext)) {
    showNotification('error', 'Unsupported Format',
      'Please upload a PDF or DOCX file.');
    return;
  }

  if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
    showNotification('error', 'File Too Large',
      `Maximum file size is ${MAX_FILE_SIZE_MB} MB.`);
    return;
  }

  if (file.size === 0) {
    showNotification('error', 'Empty File', 'The selected file is empty.');
    return;
  }

  state.selectedFile = file;
  els.dropZone.classList.add('has-file');
  els.dropIcon.textContent = ext === 'pdf' ? '📕' : '📘';
  els.dropTitle.textContent = 'File selected';
  els.dropFileName.textContent = `${file.name} (${formatBytes(file.size)})`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/* ──────────────────────────────────────────────────────────
   Analyze Submission
────────────────────────────────────────────────────────── */
let isAnalyzingInFlight = false;

async function handleAnalyze(e) {
  if (e && e.preventDefault) e.preventDefault();
  // Prevent duplicate submissions from rapid repeated clicks or race conditions
  if (isAnalyzingInFlight || state.isLoading || els.analyzeBtn.disabled) return;

  // Client-side validation
  const errors = [];
  if (!state.selectedFile) errors.push('Please upload a resume file.');
  const jd = els.jobDescription.value.trim();
  if (!jd) errors.push('Job description is required.');
  else if (jd.length < 50) errors.push('Job description must be at least 50 characters.');

  if (errors.length > 0) {
    showNotification('error', 'Validation Error', errors.join(' '));
    return;
  }

  // Mark in-flight immediately and disable button
  isAnalyzingInFlight = true;
  setLoading(true);
  showProgress(10);

  const formData = new FormData();
  formData.append('resume', state.selectedFile);
  formData.append('jobDescription', jd);
  formData.append('jobTitle', els.jobTitle.value.trim());
  formData.append('companyName', els.companyName.value.trim());

  try {
    showProgress(30);
    const res = await fetch(`${API_BASE}/analyze`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: formData,
      credentials: 'include',
    });

    showProgress(80);
    const data = await res.json();

    if (!res.ok || !data.success) {
      const errMsg = data.errors
        ? data.errors.join(' ')
        : (data.error || 'Analysis failed. Please try again.');
      const err = new Error(errMsg);
      err.status = res.status;
      err.code = data.code;
      throw err;
    }

    showProgress(100);
    await sleep(300);

    state.currentReport = data.data;
    renderResults(data.data);
    if (state.currentUser) {
      loadHistory();
    }

    els.resetBtn.classList.remove('hidden');
    els.analyzeBtn.classList.add('hidden');

    const statusNote = state.currentUser ? 'Saved to My History' : 'Guest Mode (Temporary)';
    showNotification('success', 'Analysis Complete',
      `Match score: ${data.data.matchScore}/100 · ${statusNote}`);

    // Scroll to results on mobile
    if (window.innerWidth < 1024) {
      document.getElementById('resultsPanel').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

  } catch (err) {
    console.error('[Analyze error]', err.message);

    const isQuotaOrRateLimit =
      err.code === 'QUOTA_EXHAUSTED' ||
      err.code === 'RATE_LIMIT_EXCEEDED' ||
      err.status === 429 ||
      /quota|too many requests|rate limit|RESOURCE_EXHAUSTED/i.test(err.message);

    if (isQuotaOrRateLimit) {
      showNotification(
        'error',
        'AI Quota Limit Reached',
        err.message.includes('Maximum')
          ? err.message
          : 'Gemini AI API usage quota has been reached. Please wait for the quota to reset or check your Google AI Studio plan and billing limits.'
      );
    } else {
      showNotification('error', 'Analysis Failed', err.message);
    }
  } finally {
    // Ensure button state is restored regardless of outcome
    isAnalyzingInFlight = false;
    setLoading(false);
    hideProgress();
  }
}

/* ──────────────────────────────────────────────────────────
   Loading State
────────────────────────────────────────────────────────── */
function setLoading(loading) {
  state.isLoading = loading;
  els.analyzeBtn.disabled = loading;
  els.analyzeBtn.setAttribute('aria-disabled', loading ? 'true' : 'false');
  els.analyzeBtn.classList.toggle('loading', loading);
  const btnText = els.analyzeBtn.querySelector('.btn-text');
  if (btnText) {
    btnText.textContent = loading ? 'Analysing…' : '✨ Analyze Resume';
  }
}

let progressInterval = null;
function showProgress(target) {
  els.progressWrap.classList.add('visible');
  clearInterval(progressInterval);
  let current = parseInt(els.progressBar.style.width) || 0;
  progressInterval = setInterval(() => {
    if (current >= target) { clearInterval(progressInterval); return; }
    current = Math.min(current + 2, target);
    els.progressBar.style.width = `${current}%`;
  }, 20);
}

function hideProgress() {
  clearInterval(progressInterval);
  setTimeout(() => {
    els.progressWrap.classList.remove('visible');
    els.progressBar.style.width = '0%';
  }, 400);
}

/* ──────────────────────────────────────────────────────────
   Reset
────────────────────────────────────────────────────────── */
function resetForm() {
  state.selectedFile = null;
  state.currentReport = null;

  // Reset file zone
  els.dropZone.classList.remove('has-file', 'dragover');
  els.dropIcon.textContent = '📄';
  els.dropTitle.textContent = 'Drag & drop your resume';
  els.dropFileName.textContent = '';
  els.resumeFile.value = '';

  // Clear JD (keep title/company for convenience)
  els.jobDescription.value = '';

  // Show/hide buttons
  els.resetBtn.classList.add('hidden');
  els.analyzeBtn.classList.remove('hidden');
  els.analyzeBtn.disabled = false;

  // Return to empty state
  els.emptyState.classList.remove('hidden');
  els.resultsContent.classList.add('hidden');
}

/* ──────────────────────────────────────────────────────────
   Result Rendering
────────────────────────────────────────────────────────── */
function renderResults(report) {
  els.emptyState.classList.add('hidden');
  els.resultsContent.classList.remove('hidden');

  const { analysis, matchScore, skillsScore, experienceScore, projectsScore,
          requiredSkillsTotal, requiredSkillsMatched,
          preferredSkillsTotal, preferredSkillsMatched,
          jobTitle, companyName } = report;

  // ── Score hero ─────────────────────────────────────────
  renderScoreRing(matchScore);
  animateNumber(els.scoreNumber, 0, matchScore, 1200);

  const label = matchScore >= 75 ? 'Strong Match' : matchScore >= 50 ? 'Moderate Match' : 'Needs Work';
  els.scoreTitle.textContent = label;
  els.scoreSubtitle.textContent = buildSubtitle(jobTitle, companyName);

  animateBar(els.barSkills, skillsScore);
  animateBar(els.barExp, experienceScore);
  animateBar(els.barProjects, projectsScore);
  els.valSkills.textContent = skillsScore;
  els.valExp.textContent = experienceScore;
  els.valProjects.textContent = projectsScore;

  els.metaRequired.textContent = `${requiredSkillsMatched}/${requiredSkillsTotal}`;
  els.metaPreferred.textContent = `${preferredSkillsMatched}/${preferredSkillsTotal}`;

  // ── Assessment ─────────────────────────────────────────
  els.assessmentText.textContent = analysis.overallAssessment || '—';

  // ── Matched skills ─────────────────────────────────────
  els.matchedSkillsList.innerHTML = '';
  if (analysis.matchedSkills?.length > 0) {
    analysis.matchedSkills.forEach((ms) => {
      const wrap = document.createElement('div');
      wrap.className = 'skill-badge-wrap';
      wrap.innerHTML = `
        <span class="badge badge-green">✓ ${escHtml(ms.skill)}</span>
        <div class="tooltip">${escHtml(ms.evidence || 'Found in resume')}</div>
      `;
      els.matchedSkillsList.appendChild(wrap);
    });
  } else {
    els.matchedSkillsList.innerHTML = '<span class="text-muted" style="font-size:13px;">No matching skills identified.</span>';
  }

  // ── Missing required ───────────────────────────────────
  els.missingRequiredList.innerHTML = '';
  if (analysis.missingRequiredSkills?.length > 0) {
    analysis.missingRequiredSkills.forEach((sk) => {
      els.missingRequiredList.insertAdjacentHTML('beforeend',
        `<span class="badge badge-amber">⚠ ${escHtml(sk)}</span>`);
    });
  } else {
    els.missingRequiredList.innerHTML = '<span class="badge badge-green">All required skills matched!</span>';
  }

  // ── Missing preferred ──────────────────────────────────
  els.missingPreferredList.innerHTML = '';
  if (analysis.missingPreferredSkills?.length > 0) {
    analysis.missingPreferredSkills.forEach((sk) => {
      els.missingPreferredList.insertAdjacentHTML('beforeend',
        `<span class="badge badge-blue">💡 ${escHtml(sk)}</span>`);
    });
  } else {
    els.missingPreferredList.innerHTML = '<span class="text-muted" style="font-size:13px;">No preferred skill gaps identified.</span>';
  }

  // ── Experience ─────────────────────────────────────────
  const exp = analysis.experienceAnalysis || {};
  els.expSummary.textContent = exp.summary || '—';
  els.expPill.className = `analysis-score-pill ${scorePillClass(exp.score)}`;
  els.expPill.textContent = `${exp.score ?? '?'}/100`;
  els.expHighlights.innerHTML = '';
  (exp.highlights || []).forEach((h) => {
    els.expHighlights.insertAdjacentHTML('beforeend', `<li>${escHtml(h)}</li>`);
  });

  // ── Education ──────────────────────────────────────────
  const edu = analysis.educationAnalysis || {};
  els.eduSummary.textContent = edu.summary || '—';
  els.eduPill.className = `analysis-score-pill ${scorePillClass(edu.score)}`;
  els.eduPill.textContent = `${edu.score ?? '?'}/100`;

  // ── Projects ───────────────────────────────────────────
  const proj = analysis.projectsAnalysis || {};
  els.projSummary.textContent = proj.summary || '—';
  els.projPill.className = `analysis-score-pill ${scorePillClass(proj.score)}`;
  els.projPill.textContent = `${proj.score ?? '?'}/100`;
  els.projList.innerHTML = '';
  (proj.relevantProjects || []).forEach((p) => {
    els.projList.insertAdjacentHTML('beforeend', `<li>${escHtml(p)}</li>`);
  });

  // ── Keywords ───────────────────────────────────────────
  els.keywordCloud.innerHTML = '';
  if (analysis.importantKeywords?.length > 0) {
    analysis.importantKeywords.forEach((kw) => {
      els.keywordCloud.insertAdjacentHTML('beforeend',
        `<span class="keyword-tag">${escHtml(kw)}</span>`);
    });
  } else {
    els.keywordCloud.innerHTML = '<span class="text-muted" style="font-size:13px;">No critical missing keywords.</span>';
  }

  // ── Suggestions ────────────────────────────────────────
  els.suggestionList.innerHTML = '';
  (analysis.suggestions || []).forEach((s, i) => {
    els.suggestionList.insertAdjacentHTML('beforeend', `
      <div class="suggestion-item">
        <span class="suggestion-num">${i + 1}</span>
        <span>${escHtml(s)}</span>
      </div>
    `);
  });
  if (!analysis.suggestions?.length) {
    els.suggestionList.innerHTML = '<span class="text-muted" style="font-size:13px;">No specific suggestions at this time.</span>';
  }

  // ── Strengths & Gaps ───────────────────────────────────
  els.strengthsList.innerHTML = '';
  (analysis.strengths || []).forEach((s) => {
    els.strengthsList.insertAdjacentHTML('beforeend', `
      <div class="sg-item">
        <div class="sg-dot sg-dot-green"></div>
        <span>${escHtml(s)}</span>
      </div>
    `);
  });

  els.gapsList.innerHTML = '';
  (analysis.gaps || []).forEach((g) => {
    els.gapsList.insertAdjacentHTML('beforeend', `
      <div class="sg-item">
        <div class="sg-dot sg-dot-red"></div>
        <span>${escHtml(g)}</span>
      </div>
    `);
  });
}

/* ──────────────────────────────────────────────────────────
   Score Ring Animation
────────────────────────────────────────────────────────── */
function renderScoreRing(score) {
  const circumference = 2 * Math.PI * 65; // 408.41…
  const offset = circumference - (score / 100) * circumference;

  const ring = els.scoreRing;
  ring.style.strokeDasharray = circumference;
  ring.style.strokeDashoffset = circumference; // start empty

  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444';
  ring.style.stroke = color;
  els.scoreNumber.style.color = color;

  // Trigger animation after paint
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      ring.style.strokeDashoffset = offset;
    });
  });
}

/* ──────────────────────────────────────────────────────────
   Helpers
────────────────────────────────────────────────────────── */
function animateNumber(el, from, to, duration) {
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    el.textContent = Math.round(from + (to - from) * easeOut(t));
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

function animateBar(el, value) {
  el.style.width = '0%';
  const color = value >= 75 ? 'var(--green)' : value >= 50 ? 'var(--amber)' : 'var(--red)';
  el.style.background = color;
  requestAnimationFrame(() => {
    setTimeout(() => { el.style.width = `${value}%`; }, 100);
  });
}

function scorePillClass(score) {
  if (score == null) return '';
  if (score >= 75) return 'pill-green';
  if (score >= 50) return 'pill-amber';
  return 'pill-red';
}

function buildSubtitle(title, company) {
  if (title && company) return `${title} at ${company}`;
  if (title) return title;
  if (company) return company;
  return 'Resume vs Job Description';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

/* ──────────────────────────────────────────────────────────
   History Panel
────────────────────────────────────────────────────────── */
async function loadHistory() {
  if (!state.currentUser) return;

  try {
    const res = await fetch(`${API_BASE}/analyses?limit=20`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) return;
    const data = await res.json();
    if (!data.success) return;
    renderHistory(data.data);
  } catch {
    // non-fatal — history unavailable
  }
}

function renderHistory(analyses) {
  if (!els.historyList) return;

  if (!analyses || analyses.length === 0) {
    els.historyList.innerHTML =
      '<p class="text-muted" id="historyEmptyMsg" style="font-size:13px; padding:16px 0; text-align:center;">No saved analyses yet. Run an analysis to save it to your history.</p>';
    return;
  }

  els.historyList.innerHTML = '';
  analyses.forEach((a) => {
    const score = a.match_score;
    const color = score >= 75 ? 'var(--green)' : score >= 50 ? 'var(--amber)' : 'var(--red)';
    const title = a.job_title
      ? (a.company_name ? `${a.job_title} @ ${a.company_name}` : a.job_title)
      : a.resume_filename || 'Untitled Analysis';
    const date = new Date(a.created_at).toLocaleString();

    const item = document.createElement('div');
    item.className = 'history-item';
    item.setAttribute('role', 'listitem');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-label', `${title}, score ${score}`);
    item.innerHTML = `
      <div class="history-score" style="background:${color}22; color:${color}; border:1px solid ${color}44;">
        ${score}
      </div>
      <div class="history-info">
        <div class="history-title">${escHtml(title)}</div>
        <div class="history-meta">${escHtml(date)}</div>
      </div>
      <button class="history-del" data-id="${a.id}" title="Delete this analysis" aria-label="Delete analysis">✕</button>
    `;

    // Click to load this report
    item.addEventListener('click', async (e) => {
      if (e.target.classList.contains('history-del')) return;
      await loadHistoryItem(a.id);
    });

    item.addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') await loadHistoryItem(a.id);
    });

    // Delete button
    item.querySelector('.history-del').addEventListener('click', async (e) => {
      e.stopPropagation();
      await deleteHistoryItem(a.id, item);
    });

    els.historyList.appendChild(item);
  });
}

async function loadHistoryItem(id) {
  try {
    const res = await fetch(`${API_BASE}/analyses/${id}`, {
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) { showNotification('error', 'Not Found', 'Could not load that analysis.'); return; }
    const data = await res.json();
    if (!data.success) return;

    const report = data.data;
    // Re-map snake_case from DB rows to camelCase
    state.currentReport = {
      id: report.id,
      jobTitle: report.jobTitle || report.job_title,
      companyName: report.companyName || report.company_name,
      matchScore: report.matchScore || report.match_score,
      skillsScore: report.skillsScore || report.skills_score,
      experienceScore: report.experienceScore || report.experience_score,
      projectsScore: report.projectsScore || report.projects_score,
      requiredSkillsTotal: report.requiredSkillsTotal || report.required_skills_total,
      requiredSkillsMatched: report.requiredSkillsMatched || report.required_skills_matched,
      preferredSkillsTotal: report.preferredSkillsTotal || report.preferred_skills_total,
      preferredSkillsMatched: report.preferredSkillsMatched || report.preferred_skills_matched,
      analysis: report.analysis,
    };

    renderResults(state.currentReport);

    // Show reset button
    els.resetBtn.classList.remove('hidden');
    els.analyzeBtn.classList.add('hidden');

    if (window.innerWidth < 1024) {
      document.getElementById('resultsPanel').scrollIntoView({ behavior: 'smooth' });
    }
  } catch (err) {
    showNotification('error', 'Load Failed', err.message);
  }
}

async function deleteHistoryItem(id, itemEl) {
  try {
    const res = await fetch(`${API_BASE}/analyses/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
      credentials: 'include',
    });
    if (!res.ok) { showNotification('error', 'Delete Failed', 'Could not delete that analysis.'); return; }
    itemEl.style.opacity = '0';
    itemEl.style.transition = 'opacity 200ms';
    setTimeout(() => {
      itemEl.remove();
      if (els.historyList.children.length === 0) {
        els.historyList.innerHTML =
          '<p class="text-muted" id="historyEmptyMsg" style="font-size:13px; padding:16px 0; text-align:center;">No saved analyses yet. Run an analysis to save it to your history.</p>';
      }
    }, 200);
  } catch (err) {
    showNotification('error', 'Delete Failed', err.message);
  }
}

/* ──────────────────────────────────────────────────────────
   Notifications
────────────────────────────────────────────────────────── */
function showNotification(type, title, message, duration = 5000) {
  const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
  const el = document.createElement('div');
  el.className = `notification ${type}`;
  el.setAttribute('role', 'alert');
  el.innerHTML = `
    <span class="notification-icon" aria-hidden="true">${icons[type] || 'ℹ️'}</span>
    <div class="notification-body">
      <div class="notification-title">${escHtml(title)}</div>
      ${message ? `<div class="notification-msg">${escHtml(message)}</div>` : ''}
    </div>
    <button class="notification-close" aria-label="Dismiss notification">✕</button>
  `;

  el.querySelector('.notification-close').addEventListener('click', () => dismiss(el));
  els.notifications.appendChild(el);

  if (duration > 0) setTimeout(() => dismiss(el), duration);
}

function dismiss(el) {
  if (!el.isConnected) return;
  el.style.opacity = '0';
  el.style.transform = 'translateX(16px)';
  el.style.transition = 'opacity 200ms, transform 200ms';
  setTimeout(() => el.remove(), 200);
}
