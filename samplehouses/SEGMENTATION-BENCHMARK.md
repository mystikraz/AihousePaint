# Segmentation benchmark

Run `node scripts/segmentation-benchmark.cjs` to score predictions against verified annotations. The command intentionally reports `blocked` when there are no reference labels; it never creates ground truth or substitutes an algorithm output for an annotation.

## Annotation format

Create `samplehouses/segmentation-benchmark.json` with one entry per manually reviewed paintable surface:

```json
{
  "boundaryTolerance": 2,
  "cases": [
    {
      "id": "house3-upper-facade",
      "image": "house3.jpg",
      "surface": "upper cement facade",
      "lighting": "mixed daylight and shadow",
      "width": 1024,
      "height": 1365,
      "referenceVerified": true,
      "referenceMask": "references/house3-upper-facade.mask",
      "protectedMask": "references/house3-protected.mask",
      "predictions": [
        {
          "name": "worker-lab-edge",
          "mask": "predictions/house3-upper-facade.mask",
          "thresholds": { "tolerance": 32, "edgeThreshold": 24 },
          "latencyMs": 240,
          "manualCorrectionActions": 2
        }
      ]
    }
  ]
}
```

Mask files are raw, row-major, one byte per pixel: zero is background and any nonzero byte is foreground. Width and height must match the mask exactly. Reference masks must be independently hand-traced and reviewed; only then set `referenceVerified` to `true`. Record manual correction actions from an actual editing session, not an estimate.

The evaluator reports IoU, precision, recall, boundary precision/recall/F1 within the configured pixel tolerance, protected-region leakage, differing pixels as a manual-correction proxy, end-to-end selection latency (including worker initialization on the first selection), and recorded correction actions. Scores are per case and candidate; do not aggregate unrelated image types without documenting the protocol.

## Current dataset status

Visual inventory on 2026-11-01 found six image files, but only two visually appear to be independent original house photographs:

| File | Usable for Stage 3? | Visual material/notes |
|---|---|---|
| `house3.jpg` | Yes, one photo | Unfinished cement facade with painted/plastered lower sections; one house and lighting condition. |
| `Selected photo.jpg` | Yes, one photo | Exposed-brick facade with plaster/concrete columns and railings; useful adjacent-surface challenge, but one house and lighting condition. |
| `house4.jpg` | No | App screenshot showing `house3.jpg`; not an independent photo. |
| `house2.png`, `Bihani-dilip-painted.jpg` | No | Same modern-villa rendering/visualizer scene in different paint states, not original photographs. |
| `house.png` | No | The file is not decodable by the image viewer as a PNG and has no verified source/annotation metadata. |

This leaves two candidate original photographs: one cement/plaster example and one exposed-brick/mixed example. Provenance is not independently authenticated; no separate plaster-only photo is present. There are still no manually verified reference masks, protected masks, prompt coordinates, or prediction exports. Therefore the data does **not** establish the requested benchmark and the evaluator remains blocked. No real-image IoU, precision/recall, boundary, leakage, or correction-effort scores are available.

## Worker smoke measurement (not an accuracy benchmark)

One production-browser selection on `house3.jpg` (1125x1500, 1.69 megapixels; Chrome 150 on Windows) measured 1783 ms end-to-end through the provider, including first-use worker/image initialization, and 1277 ms for worker region growing. This is a single smoke measurement, not an average or a comparison against a baseline. No peak-memory measurement was taken; the worker's RGBA, Lab, protected-mask, visited, queue, and output arrays alone require about 37 MiB at this image size, excluding canvas and transfer buffers. A qualitative mask inspection showed leakage across connected cement-like surfaces, so worker offloading improves responsiveness but does not establish improved segmentation accuracy.

## Stage 3 readiness and candidate assessment

### Dataset gate: blocked

The two visually usable originals above add an exposed-brick example, but still do not provide repeated independent coverage of each material or a plaster-only house. There are no manually verified paintable-surface or protected-region masks and no recorded click prompts. The Stage 3 dataset therefore remains insufficient; no provider comparison or accuracy score can be computed from it.

To unblock the comparison, provide independent originals covering cement, exposed brick, plaster, and mixed surfaces, with multiple challenging adjacent boundaries. For each target surface, supply a hand-traced and reviewed one-byte reference mask, a protected mask for windows/doors/railings, and the exact positive/negative click coordinates in the same source-image coordinate system. Use one shared click set per photo across providers. Record the original photo identity (preferably SHA-256), material, lighting, model/checkpoint revision, and correction actions from an actual editing session. Do not mark screenshots, resized derivatives of the same photo, or multiple surfaces from one photo as independent photographs.

### Candidates

| Candidate | Prompt/mask capability from official implementation | Deployment and performance evidence | Status here |
|---|---|---|---|
| **SAM 2.1 image predictor** | Positive and negative point labels, optional boxes, multiple candidate masks, and predicted mask-quality scores. | Official setup lists Python >=3.10, PyTorch >=2.5.1, matching TorchVision, and Linux; Windows users are directed to WSL. GPU/CUDA is recommended. It is not a browser-side dependency. | Not installed or run. No architectural accuracy, latency, or memory measurements. |
| **MobileSAM (ViT-T)** | Follows the SAM prompt/prediction interface; point labels distinguish foreground and background and the predictor returns candidate masks and quality scores. | The project documents CPU and ONNX use. Its README reports about 3 s on a Mac i5 CPU and 12 ms for its GPU pipeline, but these are upstream results, not comparable measurements on our images or hardware. Checkpoint is downloaded separately. | Not installed or run. CPU is the lower-hardware-cost candidate to try first, but quality and latency for house surfaces are unknown. |

Sources: [SAM 2 repository](https://github.com/facebookresearch/sam2), [SAM 2 install requirements](https://github.com/facebookresearch/sam2/blob/main/INSTALL.md), [SAM 2 image predictor](https://github.com/facebookresearch/sam2/blob/main/sam2/sam2_image_predictor.py), [MobileSAM repository and reported performance](https://github.com/ChaoningZhang/MobileSAM), [MobileSAM predictor](https://github.com/ChaoningZhang/MobileSAM/blob/master/mobile_sam/predictor.py).

### Target runtime inspected 2026-11-01

The available system Python reports 3.14.7 and PyTorch `2.15.0+cpu`; TorchVision, SAM 2, and MobileSAM are not installed. CUDA is unavailable and no `nvidia-smi` executable was found. This is not a verified inference environment for either candidate: SAM 2's required matching TorchVision is absent and its documented Windows path is WSL; MobileSAM's required TorchVision and checkpoint are absent. No package or checkpoint was installed, and no model was invoked.

The source repositories inspected were their current `main`/`master` pages on the date above; no immutable commit or checkpoint revision was selected, so this is a capability and deployment review, not a reproducible model evaluation. The SAM 2 and MobileSAM source repositories declare Apache-2.0. Verify the exact downloaded checkpoint's terms and any bundled third-party dependencies before commercial distribution; a repository license alone is not a release approval.

### Decision and next architecture

Do not integrate a model provider yet. The required photos, reference masks, prompts, and runnable inference environment are all missing, so an adapter would be unverified and could not demonstrate that it improves architectural wall selection. Keep the existing worker/local provider as the active option and preserve the provider abstraction.

After the dataset is ready, run a pinned MobileSAM checkpoint on CPU first, then SAM 2.1 only if an appropriate WSL/Linux GPU host is available. Compare local, model-only, and model-plus-constrained-edge-refinement predictions on the same photos and clicks. Refinement must be limited to the model's candidate region and must never cross protected pixels; measure IoU, boundary F1, protected leakage, actual correction actions, end-to-end latency, and peak memory. A local Python inference service can keep customer images on the deployment's own machine/network; there is no hosted inference or per-image model charge in this proposal, though hardware, hosting, and maintenance still cost. Do not send customer images to a third party without explicit privacy review.
