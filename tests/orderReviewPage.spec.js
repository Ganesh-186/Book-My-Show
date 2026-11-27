import { expect, test } from '@playwright/test';

import { OrderReviewPage } from '../pages/OrderReviewPage.js';

test('skips the snack prompt when its Skip control appears after the page', async ({ page }) => {
    await page.setContent(`
        <script>
            setTimeout(() => {
                const skip = document.createElement('div');
                skip.className = 'FnbBottomSheet-module-scss-module__Y9Ea-G__skipBtn';
                skip.setAttribute('role', 'button');
                skip.textContent = 'Skip';
                skip.addEventListener('click', () => {
                    skip.dataset.clicked = 'true';
                });
                document.body.append(skip);
            }, 100);
        </script>
    `);

    const orderReviewPage = new OrderReviewPage(page);

    expect(await orderReviewPage.skipSnackSelectionIfVisible()).toBe(true);

    await expect(page.locator('[role="button"]')).toHaveAttribute('data-clicked', 'true');
});

test('waits for and skips a delayed final add-on prompt', async ({ page }) => {
    await page.setContent(`
        <script>
            setTimeout(() => {
                const skip = document.createElement('div');
                skip.className = 'FnbBottomSheet-module-scss-module__Y9Ea-G__skipBtn';
                skip.setAttribute('role', 'button');
                skip.textContent = 'Skip';
                skip.addEventListener('click', () => {
                    document.body.dataset.skipClicked = 'true';
                    skip.remove();
                });
                document.body.append(skip);
            }, 100);
        </script>
    `);

    const orderReviewPage = new OrderReviewPage(page);

    expect(await orderReviewPage.skipOptionalPromptIfVisible({
        timeoutMs: 10_000,
    })).toBe(true);

    await expect(page.locator('body')).toHaveAttribute('data-skip-clicked', 'true');
});
