# Contributing Equipment to Rack Planner

Thank you for helping grow the Rack Planner equipment database! This guide explains how to add new rack-mount equipment.

## Overview

Each piece of equipment needs:
1. A **front-panel image** (transparent PNG)
2. An **entry in `equipment.json`** with metadata and dimensions

## Image Guidelines

### Finding & Preparing Images

1. **Find a high-quality front-panel image** — straight-on perspective, as close to perfectly flat as possible
2. **Correct perspective if needed:**
   - GIMP: use the Perspective tool
   - Photoshop: use Camera Raw (`Shift + Ctrl + A`) perspective tool (`Shift + T`)
3. **Remove the background** to transparent:
   - GIMP: Magic Wand → select background → Layer > Transparency > Add Alpha Channel → Layer > Transparency > Color to Alpha
   - Photoshop: Magic Wand (tolerance 12–18) → click background → Layer > Layer Mask > Hide Selection
   - Online tool: [https://onlinepngtools.com/create-transparent-png](https://onlinepngtools.com/create-transparent-png)
4. **Crop to content:**
   - GIMP: Image > Crop to Content
   - Photoshop: Image > Trim > Transparent Pixels

### Saving Images

Save to: `public/images/equipment/`

- Format: PNG-24 with transparency
- Max width: **800px** (do not enlarge smaller originals)
- Filename: **all lowercase, no spaces**, using hyphens
  - Pattern: `brand-model.png`
  - Examples: `shure-ulxd4q.png`, `furman-pl-plus-c.png`, `dbx-266xs.png`

## Equipment Data

Add your entry to `src/data/equipment.json` in the `"equipment"` array.

### JSON Format

```json
{
    "id": "brand-model",
    "name": "Model Name",
    "brand": "Brand",
    "category": "effects",
    "heightU": 1,
    "color": "#2a2a40",
    "description": "Short description of the unit",
    "image": "brand-model.png"
}
```

### Field Reference

| Field         | Type     | Required | Description |
|---------------|----------|----------|-------------|
| `id`          | string   | ✅       | Unique ID, lowercase with hyphens: `brand-model` |
| `name`        | string   | ✅       | Display name of the equipment |
| `brand`       | string   | ✅       | Manufacturer name |
| `category`    | string   | ✅       | One of: `power`, `effects`, `amplifier`, `wireless`, `interface`, `mixer`, `other` |
| `heightU`     | number   | ✅       | Rack height in U (1U, 2U, 3U, etc.) |
| `color`       | string   | ✅       | Fallback color hex code (used when no image is available) |
| `description` | string   | ✅       | Brief description of the unit's function |
| `image`       | string   | ❌       | Filename of the front-panel PNG in `public/images/equipment/`. Set to `null` if no image is available |

### Categories

| Category    | Description |
|-------------|-------------|
| `power`     | Power conditioners, distributors, UPS |
| `effects`   | Signal processors, EQ, compressors, reverbs, delays |
| `amplifier` | Power amplifiers, headphone amps |
| `wireless`  | Wireless receivers, transmitters, IEM systems, antenna distribution |
| `interface` | Audio interfaces, preamps, converters |
| `mixer`     | Digital/analog mixers, stage boxes |
| `other`     | DI boxes, patch bays, blank panels, shelves, drawers |

## Dimension Reference

Standard 19" rack dimensions for reference:
- **1U** = 1.75 inches (44.45mm)
- **Rack width** = 19 inches (482.6mm)
- **Usable equipment width** = 17.75 inches (450.85mm)

## Submitting Equipment

### Adding Equipment Yourself (Pull Request)

1. Fork this repository
2. Add your image to `public/images/equipment/`
3. Add the JSON entry to `src/data/equipment.json`
4. Run `npm run dev` to verify the equipment appears correctly
5. Submit a pull request with the brand and model name in the title

### Requesting Equipment (Issue)

If you can't add the equipment yourself, submit a request:

1. Open a [new issue](../../issues/new)
2. Include in the title: **Brand — Model Name**
3. Include:
   - A high-resolution front-panel image (top-down, straight-on)
   - The rack height in U
   - Category
   - Brief description

## Before You Submit

- ✅ Check that the equipment isn't already in the catalog
- ✅ Check [open pull requests](../../pulls) for pending additions
- ✅ Check [open issues](../../issues) for existing requests
- ✅ Ensure your image filename is all lowercase with no spaces
- ✅ Verify the equipment renders correctly in the app

## Running Locally

```bash
npm install
npm run dev
```

This starts the development server at `localhost:5173`.
