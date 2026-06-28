import { expect, test } from '@playwright/test';

test('Agentics dashboard loads stack health and services', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /control center/i })).toBeVisible();
  await expect(page.getByText(/tools api online/i)).toBeVisible();
  await expect(page.getByLabel('Service status summary').getByText('Online')).toBeVisible();
  await expect(page.getByText(/quick links/i)).toBeVisible();

  await expect(page.getByText(/n8n/i).first()).toBeVisible();
  await expect(page.getByText(/browser/i).first()).toBeVisible();
  await expect(page.getByText(/minio/i).first()).toBeVisible();
});

test('service details panel calls service detail endpoint', async ({ page }) => {
  await page.goto('/');

  const detailsButtons = page.getByRole('button', { name: /details/i });
  await expect(detailsButtons.first()).toBeVisible();

  await detailsButtons.first().click();

  await expect(page.getByText(/service detail/i)).toBeVisible();
  await expect(page.getByText(/raw api payload/i)).toBeVisible();
});

test('quick links exist but sensitive observability services are not public launch actions', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('link', { name: /open webui/i })).toHaveAttribute('href', /3000/);
  await expect(page.getByRole('link', { name: /n8n/i })).toHaveAttribute('href', /5678/);
  await expect(page.getByRole('link', { name: /grafana/i })).toHaveAttribute('href', /3002/);
  await expect(page.getByRole('link', { name: /minio console/i })).toHaveAttribute('href', /9001/);
  await expect(page.getByRole('link', { name: /adminer/i })).toHaveAttribute('href', /8088/);

  await expect(page.getByRole('link', { name: /prometheus/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /loki/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /postgres/i })).toHaveCount(0);
  await expect(page.getByRole('link', { name: /redis/i })).toHaveCount(0);
});

test('dashboard controls filter services and copy stack summary', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /filter, focus, and export your stack/i })).toBeVisible();

  const search = page.getByRole('searchbox', { name: /search services/i });
  await search.fill('ollama');

  await expect(page.getByRole('heading', { name: /ollama/i }).first()).toBeVisible();
  await expect(page.getByText(/local model runtime/i).first()).toBeVisible();

  await page.getByRole('button', { name: /^offline$/i }).click();
  await expect(page.getByText(/no services match the current filters/i)).toBeVisible();

  await page.getByRole('button', { name: /clear filters/i }).last().click();
  await expect(page.getByRole('heading', { name: /user-facing services/i })).toBeVisible();

  await page.getByRole('button', { name: /copy summary/i }).click();
  await expect(page.getByRole('button', { name: /copied summary/i })).toBeVisible();
});

test('agent chat panel can talk to a local agent', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: /talk to your local agents/i })).toBeVisible();
  await expect(page.getByText(/agents online|loading agents/i)).toBeVisible();

  const message = page.getByPlaceholder(/ask an agent/i);
  await message.fill('Reply with exactly: GUI_AGENT_OK');
  await page.getByRole('button', { name: /send to agent/i }).click();

  await expect(page.getByText(/GUI_AGENT_OK|gui_agent_ok/i)).toBeVisible({ timeout: 90_000 });
});
