## Design Context

### Users
End users of the Bihani Paints house-color visualizer, previewing paint choices on preset homes and their own uploaded house photos. The key job is to choose colors and understand exactly which architectural surface will be changed.

### Brand Personality
Practical, clear, and reassuring. Use straightforward, neutral language that helps users trust the preview without overstating AI or segmentation accuracy.

### Aesthetic Direction
Preserve the existing Bihani Paints visual language: light surfaces, restrained teal accents, and compact controls around a large house image. Keep the image and the user's active selection as the visual focus; avoid decorative effects that obscure photo details.

### Implementation Defaults
- Use the detected existing stack first: Next.js 15, React 19, TypeScript, Tailwind CSS 4, and existing Lucide icons.
- No mature component library or `components.json` configuration is present; continue the existing custom-component and utility-class patterns.
- No project-wide form, table/data-grid, or virtualization library is established.
- For any future genuinely new project, use framework-based defaults only after explicit user preferences; precedence is existing project stack, explicit preference for a new project, then framework fallback.

### Design Principles
- Make the active paintable area unmistakable while preserving the original photo's texture and detail.
- Establish hierarchy with placement, contrast, and restrained color before decoration.
- Keep interactions reversible and clearly distinguish surface selection from painting or refinement modes.
- Describe local image processing accurately; do not imply a model was used when it was not.

## Secrets and Environment Files
- Never open, read, print, modify, or commit `.env`, `.env.*`, or credential files.
- Use `.env.example` for variable names and configuration shape only.
- Never include secret values in responses, logs, patches, screenshots, or tests.
- If a task needs a secret, use a separately injected runtime value or ask the user to provide a sanitized placeholder.
