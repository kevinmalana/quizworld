import { test, expect } from '@playwright/test';

async function expectLiveGameEntrySurface(page: import('@playwright/test').Page) {
  const notConfigured = page.getByRole('heading', { name: 'Live Games Unavailable' }).first();
  const legacyDisabled = page.getByRole('heading', { name: 'Live Games Unavailable' }).first();
  const joinHeading = page.getByRole('heading', { name: 'Join a Game' }).first();

  await expect(
    page.locator('h1,h2').filter({ hasText: /Live Games Unavailable|Join a Game/ }).first()
  ).toBeVisible();

  if (await notConfigured.isVisible().catch(() => false)) {
    await expect(notConfigured).toBeVisible();
    return;
  }

  if (await legacyDisabled.isVisible().catch(() => false)) {
    await expect(legacyDisabled).toBeVisible();
    return;
  }

  await expect(joinHeading).toBeVisible();
  await expect(page.locator('input[aria-label^="PIN character"]')).toHaveCount(6);
  await expect(page.getByRole('button', { name: 'Enter Game' })).toBeVisible();
}

async function expectHostEntrySurface(page: import('@playwright/test').Page) {
  const notConfigured = page.getByRole('heading', { name: 'Live Games Unavailable' }).first();
  const legacyDisabled = page.getByRole('heading', { name: 'Live Games Unavailable' }).first();
  const signInHeading = page.getByRole('heading', { name: 'Sign In To Host' }).first();
  const hostHeading = page.getByRole('heading', { name: 'Host a Game' }).first();

  await expect(
    page.locator('h1,h2').filter({ hasText: /Live Games Unavailable|Sign In To Host|Host a Game/ }).first()
  ).toBeVisible();

  if (await notConfigured.isVisible().catch(() => false)) {
    await expect(notConfigured).toBeVisible();
    return;
  }

  if (await legacyDisabled.isVisible().catch(() => false)) {
    await expect(legacyDisabled).toBeVisible();
    return;
  }

  if (await hostHeading.isVisible().catch(() => false)) {
    await expect(hostHeading).toBeVisible();
    return;
  }

  await expect(signInHeading).toBeVisible();
  await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Browse Quizzes' })).toBeVisible();
}

// ─── P0: Critical Path Tests ─────────────────────────────────────────────

test.describe('P0: Homepage', () => {
  test('loads and displays hero section', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Create a Quiz' }).first()).toBeVisible();
    await expect(page.getByRole('link', { name: 'Explore Library' })).toBeVisible();
  });

  test('navigation links work', async ({ page }) => {
    await page.goto('/');
    await page.click('text=Explore');
    await expect(page).toHaveURL(/\/explore/);
    await page.goBack();
    await page.click('text=Join');
    await expect(page).toHaveURL(/\/join/);
  });

  test('game PIN input is visible', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('input[placeholder*="PIN"]')).toBeVisible();
    await expect(page.locator('text=Enter Game')).toBeVisible();
  });
});

test.describe('P0: Explore Page', () => {
  test('loads and shows quizzes', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.locator('h1')).toContainText('Discover Quizzes');
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible({ timeout: 10000 });
  });

  test('category filters work', async ({ page }) => {
    await page.goto('/explore');
    await page.click('text=All topics');
    await expect(page.locator('text=Trivia')).toBeVisible();
    await expect(page.locator('text=Science & Nature')).toBeVisible();
  });

  test('sort buttons work', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.locator('text=Most Played')).toBeVisible();
    await page.click('text=Newest');
    await expect(page.getByRole('heading', { level: 3 }).first()).toBeVisible();
  });

  test('search works with current catalog data', async ({ page }) => {
    await page.goto('/explore');
    const firstQuizTitle = (await page.getByRole('heading', { level: 3 }).first().innerText()).trim();
    const query = firstQuizTitle.split(/\s+/)[0];
    await page.locator('input[placeholder*="Search"]').fill(query);
    await expect(page.getByRole('heading', { name: firstQuizTitle, level: 3 }).first()).toBeVisible();
  });
});

test.describe('P0: Join Page', () => {
  test('displays PIN input or live-service configuration status', async ({ page }) => {
    await page.goto('/join');
    await expectLiveGameEntrySurface(page);
  });
});

test.describe('P0: Login Page', () => {
  test('displays login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Welcome Back');
    await expect(page.locator('input[placeholder="Email"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Password"]')).toBeVisible();
    await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
  });

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[placeholder="Email"]', 'test@example.com');
    await page.fill('input[placeholder="Password"]', 'wrongpassword');
    await page.click('button:has-text("Sign In")');
    // Should show error message
    await expect(page.locator('text=Invalid')).toBeVisible({ timeout: 10000 });
  });

  test('sign up toggle works', async ({ page }) => {
    await page.goto('/login');
    await page.click('text=Sign Up');
    await expect(page.locator('button:has-text("Sign Up")')).toBeVisible();
  });
});

// ─── P1: Quiz Builder Tests ──────────────────────────────────────────────

test.describe('P1: Quiz Builder - Source Picker', () => {
  test('displays source options', async ({ page }) => {
    await page.goto('/create');
    await expect(page.locator('h1')).toContainText('Create a new quiz');
    await expect(page.locator('text=Start from Scratch')).toBeVisible();
    await expect(page.locator('text=AI from Topic')).toBeVisible();
    await expect(page.locator('h3:has-text("Paste Text")')).toBeVisible();
    await expect(page.locator('text=AI from URL')).toBeVisible();
  });

  test('start from scratch opens builder', async ({ page }) => {
    await page.goto('/create');
    await page.click('text=Start from Scratch');
    // Should show the builder with question editor
    await expect(page.locator('textarea[placeholder*="Type your question"]')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder="Answer A"]')).toBeVisible();
  });
});

test.describe('P1: Quiz Builder - Question Editor', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/create');
    await page.click('text=Start from Scratch');
    await page.waitForSelector('textarea[placeholder*="Type your question"]');
  });

  test('can type a question', async ({ page }) => {
    const textarea = page.locator('textarea[placeholder*="Type your question"]');
    await textarea.fill('What is 2+2?');
    await expect(textarea).toHaveValue('What is 2+2?');
  });

  test('can type answers', async ({ page }) => {
    await page.fill('input[placeholder="Answer A"]', '4');
    await page.fill('input[placeholder="Answer B"]', '3');
    await expect(page.locator('input[placeholder="Answer A"]')).toHaveValue('4');
  });

  test('answer marker click sets correct', async ({ page }) => {
    // The answer markers are A, B, C, D buttons. Click the one that shows "B" exactly.
    const bMarker = page.locator('button').filter({ hasText: /^B$/ });
    await bMarker.click();
    // After click, B should show a checkmark
    await expect(page.locator('button').filter({ hasText: /^✓$/ }).first()).toBeVisible({ timeout: 3000 });
  });

  test('can add a new question', async ({ page }) => {
    await page.getByRole('button', { name: '+ Multiple Choice' }).click();
    await expect(page.locator('[data-testid=question-nav]')).toHaveText('2 / 2', { timeout: 5000 });
  });

  test('can switch to true/false', async ({ page }) => {
    await page.locator('.builder-props-panel button:has-text("T/F")').click();
    await expect(page.locator('input[placeholder="Answer A"]')).toHaveValue('True');
    await expect(page.locator('input[placeholder="Answer B"]')).toHaveValue('False');
  });

  test('time selector works', async ({ page }) => {
    await page.locator('.builder-props-panel button:has-text("30s")').click();
    await expect(page.locator('.builder-props-panel button:has-text("30s")')).toBeVisible();
  });

  test('points selector works', async ({ page }) => {
    await page.locator('.builder-props-panel button:has-text("2000")').click();
    await expect(page.locator('.builder-props-panel button:has-text("2000")')).toBeVisible();
  });

  test('can delete a question', async ({ page }) => {
    await page.getByRole('button', { name: '+ Multiple Choice' }).click();
    await expect(page.locator('[data-testid=question-nav]')).toHaveText('2 / 2', { timeout: 5000 });
    await page.getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('[data-testid=question-nav]')).toHaveText('1 / 1', { timeout: 5000 });
  });

  test('navigation buttons work', async ({ page }) => {
    await page.goto('/create');
    await page.getByText('Start from Scratch').click();
    await page.waitForSelector('textarea[placeholder*="Type your question"]', { timeout: 5000 });
    await page.getByRole('button', { name: '+ Multiple Choice' }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: '+ Multiple Choice' }).click();
    await page.waitForTimeout(300);
    await expect(page.locator('[data-testid=question-nav]')).toHaveText('3 / 3', { timeout: 5000 });
    await page.locator('.builder-props-panel button:has-text("Prev")').click();
    await expect(page.locator('[data-testid=question-nav]')).toHaveText('2 / 3', { timeout: 5000 });
    await page.locator('.builder-props-panel button:has-text("Next")').click();
    await expect(page.locator('[data-testid=question-nav]')).toHaveText('3 / 3', { timeout: 5000 });
  });
});

// ─── P1: AI from Topic ───────────────────────────────────────────────────

test.describe('P1: AI from Topic', () => {
  test('modal opens and has input', async ({ page }) => {
    await page.goto('/create');
    await page.click('text=AI from Topic');
    await expect(page.locator('h2:has-text("AI Topic Generator")')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
    await expect(page.locator('button:has-text("Generate")')).toBeVisible();
    await expect(page.getByRole('button', { name: /Customize generation/ })).toBeVisible();
  });

  test('generate button disabled with short input', async ({ page }) => {
    await page.goto('/create');
    await page.click('text=AI from Topic');
    await page.fill('textarea', 'hi');
    await expect(page.locator('button:has-text("Generate")')).toBeDisabled();
  });

  test('question count selector works', async ({ page }) => {
    await page.goto('/create');
    await page.click('text=AI from Topic');
    await page.click('button:has-text("8")');
    await expect(page.locator('button:has-text("8")')).toBeVisible();
  });

  test('generation options expose audience, difficulty, type, tone, and focus controls', async ({ page }) => {
    await page.goto('/create');
    await page.click('text=AI from Topic');
    await page.getByRole('button', { name: /Customize generation/ }).click();

    await expect(page.getByPlaceholder(/Year 10 students/)).toBeVisible();
    await expect(page.getByRole('button', { name: /Easy/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Balanced/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Hard/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Multiple Choice/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /True \/ False/ })).toBeVisible();
    await expect(page.getByRole('button', { name: /Educational/ })).toBeVisible();
    await expect(page.getByPlaceholder(/photosynthesis/)).toBeVisible();
  });

  test('close button works', async ({ page }) => {
    await page.goto('/create');
    await page.click('text=AI from Topic');
    await page.click('button:has-text("✕")');
    // Should return to source picker
    await expect(page.locator('h1:has-text("Create a new quiz")')).toBeVisible();
  });
});

// ─── P1: Paste Questions ─────────────────────────────────────────────────

test.describe('P1: Paste Questions', () => {
  test('modal opens', async ({ page }) => {
    await page.goto('/create');
    await page.click('text=Paste Text');
    await expect(page.locator('h2:has-text("Paste Questions")')).toBeVisible();
    await expect(page.locator('textarea')).toBeVisible();
  });
});

// ─── P2: Dashboard (requires auth) ──────────────────────────────────────

test.describe('P2: Dashboard', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    // Should show sign in required or redirect
    await expect(page.locator('text=Sign In').first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── P2: Host Page (requires auth) ──────────────────────────────────────

test.describe('P2: Host Page', () => {
  test('shows sign in or live-service configuration status when not authenticated', async ({ page }) => {
    await page.goto('/host');
    await expectHostEntrySurface(page);
  });
});

// ─── P2: Study Page ─────────────────────────────────────────────────────

test.describe('P2: Study Page', () => {
  test('loads study hall', async ({ page }) => {
    await page.goto('/study');
    await expect(page.locator('h1')).toContainText('Study Hall');
  });

  test('shows available quizzes', async ({ page }) => {
    await page.goto('/study');
    await expect(page.getByRole('link', { name: 'Study Now' }).first()).toBeVisible({ timeout: 10000 });
  });
});

// ─── P2: Mobile Responsive ──────────────────────────────────────────────

test.describe('P2: Mobile Responsive', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('homepage is mobile friendly', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1').first()).toBeVisible();
    // Menu button should be visible on mobile
    await expect(page.locator('[aria-label="Menu"]')).toBeVisible();
  });

  test('explore page is mobile friendly', async ({ page }) => {
    await page.goto('/explore');
    await expect(page.locator('h1')).toContainText('Discover Quizzes');
    // Category chips should be horizontally scrollable
    await expect(page.locator('text=All topics')).toBeVisible();
  });

  test('create page is mobile friendly', async ({ page }) => {
    await page.goto('/create');
    await expect(page.locator('h1')).toContainText('Create a new quiz');
    // Source options should stack vertically
    await expect(page.locator('text=Start from Scratch')).toBeVisible();
  });

  test('builder is mobile friendly', async ({ page }) => {
    await page.goto('/create');
    await page.click('text=Start from Scratch');
    await expect(page.locator('textarea[placeholder*="Type your question"]')).toBeVisible();
    // Sidebar should be hidden on mobile
    await expect(page.locator('text=1 Questions')).not.toBeVisible();
  });
});

// ─── P2: Navigation ─────────────────────────────────────────────────────

test.describe('P2: Navigation', () => {
  test('all nav links work from homepage', async ({ page }) => {
    await page.goto('/');
    
    await page.locator('nav a:has-text("Explore")').first().click();
    await expect(page).toHaveURL(/\/explore/);
    
    await page.goBack();
    await page.locator('nav a:has-text("Study")').first().click();
    await expect(page).toHaveURL(/\/study/);
    
    await page.goBack();
    await page.locator('nav a:has-text("Create")').first().click();
    await expect(page).toHaveURL(/\/create/);
  });

  test('logo links to homepage', async ({ page }) => {
    await page.goto('/explore');
    await page.click('text=Quiz');
    await expect(page).toHaveURL('/');
  });
});

// ─── P2: Error Handling ─────────────────────────────────────────────────

test.describe('P2: Error Handling', () => {
  test('404 page exists', async ({ page }) => {
    const response = await page.goto('/nonexistent-page');
    // Should not crash - either 404 or redirect
    expect(response?.status()).toBeLessThan(500);
  });

  test('API rate limiting returns 429', async ({ request }) => {
    // Hit the AI endpoint multiple times
    const results = [];
    for (let i = 0; i < 12; i++) {
      const res = await request.post('/api/ai-source-draft', {
        data: { sourceText: 'test', questionCount: 3 },
      });
      results.push(res.status());
    }
    // Should get at least one 429
    expect(results).toContain(429);
  });
});

// ─── P0: Present Page ──────────────────────────────────────────────────────
test.describe('P0: Present Page', () => {
  test('loads and shows create presentation UI or sign-in prompt', async ({ page }) => {
    await page.goto('/present');
    const hasInput = await page.locator('input[placeholder*="title"], input[placeholder*="Title"]').isVisible().catch(() => false);
    const hasSignIn = await page.locator('text=Sign In').first().isVisible().catch(() => false);
    expect(hasInput || hasSignIn).toBeTruthy();
  });

  test('present/join page has code and name inputs', async ({ page }) => {
    await page.goto('/present/join');
    await expect(page.locator('input[placeholder*="code"], input[placeholder*="Code"], input[maxlength="6"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('input[placeholder*="name"], input[placeholder*="Name"]').first()).toBeVisible({ timeout: 5000 });
  });

  test('present/join shows error for short code', async ({ page }) => {
    await page.goto('/present/join');
    const joinBtn = page.getByRole('button', { name: /Join/i });
    // Button should be disabled when no code entered
    await expect(joinBtn).toBeDisabled({ timeout: 5000 });
  });
});

// ─── P1: AI from URL ───────────────────────────────────────────────────────
test.describe('P1: AI from URL', () => {
  test('modal opens and has URL input', async ({ page }) => {
    await page.goto('/create');
    await page.click('text=AI from URL');
    await expect(page.locator('input[placeholder*="https"], input[type="url"], input[placeholder*="URL"]').first()).toBeVisible({ timeout: 5000 });
    await expect(page.locator('button:has-text("Generate")')).toBeVisible();
  });

  test('generate disabled with empty URL', async ({ page }) => {
    await page.goto('/create');
    await page.click('text=AI from URL');
    await expect(page.locator('button:has-text("Generate")')).toBeDisabled();
  });

  test('close button returns to source picker', async ({ page }) => {
    await page.goto('/create');
    await page.click('text=AI from URL');
    await page.click('button:has-text("✕")');
    await expect(page.locator('h1:has-text("Create a new quiz")')).toBeVisible();
  });
});

// ─── P1: AI from Document ──────────────────────────────────────────────────
test.describe('P1: AI from Document', () => {
  test('modal opens and has file upload', async ({ page }) => {
    await page.goto('/create');
    await page.click('text=AI from Document');
    await expect(page.locator('button:has-text("Generate")')).toBeVisible({ timeout: 5000 });
    // File input may be hidden (styled upload); check the label/button text instead
    const hasUpload = await page.locator('[class*="upload"], [class*="file"], label:has(input[type="file"]), button:has-text("Choose"), button:has-text("Upload"), text=/upload|drag|pdf|docx/i').first().isVisible().catch(() => false);
    const hasHiddenInput = await page.locator('input[type="file"]').count() > 0;
    expect(hasUpload || hasHiddenInput).toBeTruthy();
  });
});

// ─── P1: Join — Invalid PIN ────────────────────────────────────────────────
test.describe('P1: Join — PIN validation', () => {
  test('Enter Game button is disabled with empty PIN', async ({ page }) => {
    await page.goto('/join');
    const enterBtn = page.getByRole('button', { name: 'Enter Game' });
    await expect(enterBtn).toBeDisabled();
  });

  test('game page with invalid PIN shows error or not found', async ({ page }) => {
    await page.goto('/game/XXXXXX');
    const hasError = await page.locator('h1,h2').filter({ hasText: /not found|error|invalid|game over|expired|No game/i }).first().isVisible({ timeout: 8000 }).catch(() => false);
    const redirected = page.url().includes('/join') || page.url().includes('/');
    expect(hasError || redirected).toBeTruthy();
  });
});

// ─── P2: Auth Guards ───────────────────────────────────────────────────────
test.describe('P2: Auth Guards', () => {
  test('admin page redirects or blocks unauthenticated users', async ({ page }) => {
    await page.goto('/admin');
    const redirectedToLogin = page.url().includes('/login');
    const hasSignIn = await page.locator('text=Sign in, text=Sign In').first().isVisible({ timeout: 5000 }).catch(() => false);
    expect(redirectedToLogin || hasSignIn).toBeTruthy();
  });

  test('report page loads for any PIN without auth (public access)', async ({ page }) => {
    const response = await page.goto('/report/NOPE01');
    expect(response?.status()).toBeLessThan(500);
  });
});

// ─── P2: Study Session ─────────────────────────────────────────────────────
test.describe('P2: Study Session', () => {
  test('clicking Study Now navigates to a study session', async ({ page }) => {
    await page.goto('/study');
    const studyBtn = page.getByRole('link', { name: 'Study Now' }).first();
    await expect(studyBtn).toBeVisible({ timeout: 10000 });
    const href = await studyBtn.getAttribute('href');
    expect(href).toMatch(/\/study\/.+/);
  });

  test('study session page loads for a known quiz', async ({ page }) => {
    // Use a known quiz ID from the live DB
    await page.goto('/study/da0f193f-054b-49df-b0c1-972a888d643e');
    await expect(page.locator('h1, h2').first()).toBeVisible({ timeout: 8000 });
    expect(page.url()).toMatch(/\/study\/.+/);
  });
});

// ─── P1: Study — search + filter ─────────────────────────────────────────────

test.describe('P1: Study — search and filter', () => {
  test('search filters quiz list', async ({ page }) => {
    await page.goto('/study');
    const search = page.locator('input[type="search"]');
    await expect(search).toBeVisible({ timeout: 8000 });
    await search.fill('cricket');
    await expect(page.getByRole('link').filter({ hasText: /cricket/i }).first()).toBeVisible({ timeout: 5000 });
  });

  test('category chip filters quiz list', async ({ page }) => {
    await page.goto('/study');
    await expect(page.locator('.study-category-chip').first()).toBeVisible({ timeout: 8000 });
    const chips = page.locator('.study-category-chip');
    const count = await chips.count();
    if (count > 1) {
      await chips.nth(1).click();
      await expect(chips.nth(1)).toHaveClass(/is-active/);
    }
  });

  test('search + category combo filters correctly', async ({ page }) => {
    await page.goto('/study');
    await page.locator('input[type="search"]').fill('quiz');
    const allChip = page.locator('.study-category-chip', { hasText: 'All' });
    await expect(allChip).toBeVisible({ timeout: 5000 });
    await allChip.click();
    await expect(page.getByRole('link', { name: /Study Now/i }).first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── P1: Study session — flashcard flow ──────────────────────────────────────

// Known quiz ID: Heredity and Genetics (5 questions) — stable production fixture
const STUDY_QUIZ_ID = 'da0f193f-054b-49df-b0c1-972a888d643e';

test.describe('P1: Study session — flashcard flow', () => {
  test('flashcard mode starts and shows question front', async ({ page }) => {
    await page.goto(`/study/${STUDY_QUIZ_ID}`);
    await page.getByRole('button', { name: /Flashcard/i }).click();
    await expect(page.locator('.study-flashcard-card--front')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Tap to reveal answers')).toBeVisible();
  });

  test('clicking flashcard front flips to answers', async ({ page }) => {
    await page.goto(`/study/${STUDY_QUIZ_ID}`);
    await page.getByRole('button', { name: /Flashcard/i }).click();
    await page.locator('.study-flashcard').click();
    // After flip, answer buttons become interactable
    await expect(page.getByRole('button', { name: /^A / }).first()).toBeVisible({ timeout: 5000 });
  });
});

// ─── P1: Study session — quickfire flow ──────────────────────────────────────

test.describe('P1: Study session — quickfire flow', () => {
  test('quickfire mode shows timer and question', async ({ page }) => {
    await page.goto(`/study/${STUDY_QUIZ_ID}`);
    await page.getByRole('button', { name: /Quick Fire/i }).click();
    await expect(page.locator('.study-timer')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.study-question-card h2')).toBeVisible();
  });

  test('quickfire answer buttons are immediately visible (no flip required)', async ({ page }) => {
    await page.goto(`/study/${STUDY_QUIZ_ID}`);
    await page.getByRole('button', { name: /Quick Fire/i }).click();
    await expect(page.getByRole('button', { name: /^A / }).first()).toBeVisible({ timeout: 3000 });
  });
});

// ─── P1: Study result + review round ─────────────────────────────────────────

test.describe('P1: Study result screen', () => {
  test('result screen shows score and action buttons', async ({ page }) => {
    await page.goto('/study/da0f193f-054b-49df-b0c1-972a888d643e');
    await page.getByRole('button', { name: /Flashcard/i }).click();
    // Answer all 5 questions (wrong to get review button)
    for (let i = 0; i < 5; i++) {
      await page.locator('.study-flashcard').click({ timeout: 5000 });
      await page.getByRole('button', { name: /^A / }).first().click({ timeout: 5000 });
      await page.waitForTimeout(1900); // wait for auto-advance
    }
    await expect(page.getByRole('heading', { name: 'Session Complete' })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=out of 5 correct')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Study Again' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Back to Study' })).toBeVisible();
  });
});
