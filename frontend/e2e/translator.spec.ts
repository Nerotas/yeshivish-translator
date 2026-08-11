import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  const glossaryTerms = Array.from({ length: 12 }, (_, index) => ({
    id: index + 2,
    term: `Term ${String(index + 1).padStart(2, "0")}`,
    display_terms: {
      shabbos: `Term ${String(index + 1).padStart(2, "0")}`,
      shabbat: `Term ${String(index + 1).padStart(2, "0")}`,
    },
    variants: [`Alternate ${index + 1}`],
    meanings: [`Meaning ${index + 1}`],
    context_note: `Context ${index + 1}`,
    category: "test category",
    language_origin: "Hebrew",
    yeshivish_example: `Yeshivish example ${index + 1}`,
    plain_english_example: `English example ${index + 1}`,
  }));

  await page.route("**/api/glossary/", async (route) => {
    const results = [
      {
        id: 1,
        term: "Shabbos",
        display_terms: { shabbos: "Shabbos", shabbat: "Shabbat" },
        variants: ["Shabbat", "Shabbas"],
        meanings: ["the Jewish Sabbath"],
        context_note: "The weekly sacred day of rest.",
        category: "religious practice",
        language_origin: "mixed",
        yeshivish_example: "We are staying for Shabbos.",
        plain_english_example: "We are staying for the Sabbath.",
      },
      ...glossaryTerms,
    ];
    await route.fulfill({ json: { count: results.length, results } });
  });

  await page.route("**/api/auth/session/", async (route) => {
    await route.fulfill({
      json: {
        access_token: "e2e-test-token",
        token_type: "Bearer",
        expires_in: 300,
      },
    });
  });

  await page.route("**/api/translate/", async (route) => {
    const request = route.request().postDataJSON() as { direction?: string };
    const translation =
      request.direction === "english_to_yeshivish"
        ? "That was mamash a geshmake shiur—gevaldig!"
        : "That was really an enjoyable lesson.";

    await route.fulfill({ json: { translation } });
  });
});

test("translates in both directions and persists global preferences", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByLabel("Yeshivish text").fill("That was mamesh geshmak.");
  await page.getByRole("button", { name: "Translate" }).click();
  await expect(
    page.getByText("That was really an enjoyable lesson."),
  ).toBeVisible();

  await page.getByRole("button", { name: "English → Yeshivish" }).click();
  await page.getByLabel("English text").fill("That was an enjoyable lesson.");
  await page.getByRole("button", { name: "Translate" }).click();
  await expect(
    page.getByText("That was mamash a geshmake shiur—gevaldig!"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Dark" }).click();
  await page.getByRole("button", { name: "Shabbat" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.reload();
  await expect(page.getByRole("button", { name: "Dark" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("button", { name: "Shabbat" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("shows a privacy notice that links to the data-handling details", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByText(/submitted text is sent to openai/i),
  ).toBeVisible();

  const link = page.getByRole("link", {
    name: "Learn how your data is handled",
  });
  await expect(link).toHaveAttribute("href", "#privacy-details");

  await link.click();
  await expect(
    page.getByRole("heading", { name: "How your data is handled" }),
  ).toBeInViewport();
});

test("has no automatically detectable accessibility violations", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByText(/submitted text is sent to openai/i),
  ).toBeVisible();
  const lightResults = await new AxeBuilder({ page }).analyze();
  expect(lightResults.violations).toEqual([]);

  await page.getByRole("button", { name: "Dark" }).click();
  await expect(
    page.getByText(/submitted text is sent to openai/i),
  ).toBeVisible();
  const darkResults = await new AxeBuilder({ page }).analyze();
  expect(darkResults.violations).toEqual([]);
});

test("searches, sorts, paginates, and applies pronunciation in the glossary", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Glossary" }).click();

  await expect(
    page.getByRole("heading", { name: "Yeshivish glossary" }),
  ).toBeVisible();
  await expect(page).toHaveURL(/#\/glossary$/);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Yeshivish glossary" }),
  ).toBeVisible();
  await expect(page.getByText("Browse 13 terms.")).toBeVisible();

  const search = page.getByRole("searchbox", { name: "Search…" });
  await search.fill("weekly sacred");
  await expect(page.getByRole("gridcell", { name: "Shabbos" })).toBeVisible();
  await expect(page.locator(".MuiDataGrid-row")).toHaveCount(1);

  await page.getByRole("button", { name: "Shabbat" }).click();
  await expect(
    page.getByRole("gridcell", { name: "Shabbat", exact: true }),
  ).toBeVisible();

  await search.clear();
  await page.getByRole("columnheader", { name: "Term" }).click();
  await expect(page.locator(".MuiDataGrid-row")).toHaveCount(10);
  await page.getByRole("button", { name: "Go to next page" }).click();
  await expect(page.getByText("11–13 of 13")).toBeVisible();
});

test("keeps the glossary usable on mobile without accessibility violations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("link", { name: "Glossary" }).click();

  await expect(page.getByTestId("glossary-grid")).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: "Alternate spellings" }),
  ).toBeHidden();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
