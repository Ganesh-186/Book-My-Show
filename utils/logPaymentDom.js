export async function logPaymentDom(page, label) {
    const dom = await page.locator('#pay').evaluate((root) => {
        const lines = [];

        const visit = (element, depth) => {
            if (lines.length >= 250) {
                return;
            }

            const indent = '  '.repeat(depth);
            const attributes = Array.from(element.attributes)
                .filter((attribute) => attribute.value.length < 300)
                .map((attribute) => `${attribute.name}="${attribute.value}"`)
                .join(' ');
            const text = Array.from(element.childNodes)
                .filter((node) => node.nodeType === Node.TEXT_NODE)
                .map((node) => node.textContent.trim())
                .filter(Boolean)
                .join(' ')
                .slice(0, 180);

            lines.push(
                `${indent}<${element.tagName.toLowerCase()}${attributes ? ` ${attributes}` : ''}>${text ? ` ${text}` : ''}`,
            );

            for (const child of element.children) {
                visit(child, depth + 1);
            }

            if (element.shadowRoot) {
                lines.push(`${indent}  #shadow-root`);
                for (const child of element.shadowRoot.children) {
                    visit(child, depth + 2);
                }
            }
        };

        visit(root, 0);
        return lines.join('\n');
    });

    console.log(`\n--- Payment DOM ${label} ---\n${dom}\n--- End payment DOM ---`);
}
