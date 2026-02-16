# Motherboard Annotation Tool

This web application is designed for auditing the physical condition of computer motherboards.

## Features
- **Board Selection**: Auto-fills form factor based on board model.
- **Functional Zones**: Annotate specific areas like CPU Socket, RAM Slots, PCIe, etc.
- **Detailed Audit**: Score integrity, functionality, and cosmetic state for each zone.
- **Component Analysis**: Mark individual components (capacitors, MOSFETs) with integrity scores.
- **Technical Condition Grade**: Automatically calculates a global grade (1-3) based on your audit.

## Setup
1. Open `sablona.html` in any modern web browser.
2. The default image `motherboard1.png` will load automatically.
3. Start annotating!

## Files
- `sablona.html`: Main application file.
- `app.js`: Logic for drawing, scoring, and data management.
- `styles.css`: Visual styling.
- `motherboard1.png`: Default schematic image.
