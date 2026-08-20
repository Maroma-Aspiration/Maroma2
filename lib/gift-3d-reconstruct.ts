import { fal } from "@fal-ai/client";
import { uploadCanvasPublicBuffer, uploadPublicBinary } from "./canvas-public-upload";
import type { Gift3dProductAsset, Gift3dRefLabel } from "./gift-3d-assets-store";

export const HUNYUAN_IMAGE_TO_3D = "fal-ai/hunyuan-3d/v3.1/pro/image-to-3d";
const FACE_COUNT = 50_000;

export function isGift3dReconstructConfigured(): boolean {
  return Boolean(process.env.FAL_KEY?.trim());
}

type HunyuanInput = {
  input_image_url: string;
  back_image_url?: string;
  left_image_url?: string;
  right_image_url?: string;
  top_image_url?: string;
  generate_type: "Normal";
  enable_pbr: true;
  face_count: number;
};

type HunyuanFile = { url?: string };
type HunyuanOutput = {
  model_glb?: HunyuanFile;
  thumbnail?: HunyuanFile;
  model_urls?: { glb?: HunyuanFile };
};

function usedRefs(asset: Gift3dProductAsset) {
  return asset.refs.filter((ref) => ref.useFor3d !== false && ref.url.trim());
}

function urlForLabel(asset: Gift3dProductAsset, label: Gift3dRefLabel): string | undefined {
  return usedRefs(asset).find((ref) => ref.label === label)?.url;
}

export function buildHunyuanInput(
  asset: Gift3dProductAsset,
  catalogImageUrl?: string
): HunyuanInput {
  const used = usedRefs(asset);
  const front =
    urlForLabel(asset, "front") ||
    urlForLabel(asset, "label") ||
    used[0]?.url ||
    (asset.catalogImageUsable ? catalogImageUrl?.trim() : "") ||
    "";
  if (!front) {
    throw new Error(
      "Need at least one isolated product photo (front or label) before generating a mesh."
    );
  }

  const input: HunyuanInput = {
    input_image_url: front,
    generate_type: "Normal",
    enable_pbr: true,
    face_count: FACE_COUNT,
  };

  const back = urlForLabel(asset, "back");
  const left = urlForLabel(asset, "left");
  const right = urlForLabel(asset, "right");
  const top = urlForLabel(asset, "top");
  if (back && back !== front) input.back_image_url = back;
  if (left && left !== front) input.left_image_url = left;
  if (right && right !== front) input.right_image_url = right;
  if (top && top !== front) input.top_image_url = top;
  return input;
}

async function persistRemoteFile(
  url: string,
  prefix: string,
  contentType: string,
  ext: string
): Promise<string> {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Could not download reconstructed ${ext.toUpperCase()} (${res.status}).`);
  }
  const buffer = Buffer.from(await res.arrayBuffer());
  if (ext === "glb") {
    const uploaded = await uploadPublicBinary(prefix, buffer, contentType, ext);
    return uploaded.url;
  }
  const uploaded = await uploadCanvasPublicBuffer(prefix, buffer, contentType);
  return uploaded.url;
}

export async function reconstructGift3dMesh(
  asset: Gift3dProductAsset,
  catalogImageUrl?: string
): Promise<Pick<Gift3dProductAsset, "glbUrl" | "glbThumbnailUrl" | "reconstructionProvider">> {
  if (!isGift3dReconstructConfigured()) {
    throw new Error(
      "FAL_KEY is not set. Add a fal.ai API key in Vercel environment variables, then generate the mesh again."
    );
  }

  const input = buildHunyuanInput(asset, catalogImageUrl);
  const result = await fal.subscribe(HUNYUAN_IMAGE_TO_3D, {
    input,
    logs: false,
  });
  const data = (result.data ?? result) as HunyuanOutput;
  const glbSource = data.model_glb?.url || data.model_urls?.glb?.url;
  if (!glbSource) {
    throw new Error("The reconstruction model did not return a GLB file.");
  }

  const glbUrl = await persistRemoteFile(glbSource, "gift-3d-glb", "model/gltf-binary", "glb");
  let glbThumbnailUrl: string | undefined;
  if (data.thumbnail?.url) {
    try {
      glbThumbnailUrl = await persistRemoteFile(
        data.thumbnail.url,
        "gift-3d-glb-thumb",
        "image/png",
        "png"
      );
    } catch {
      glbThumbnailUrl = undefined;
    }
  }

  return {
    glbUrl,
    glbThumbnailUrl,
    reconstructionProvider: HUNYUAN_IMAGE_TO_3D,
  };
}
