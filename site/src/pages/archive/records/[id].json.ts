// One JSON file per manuscript record, loaded by the archive page when a manuscript is opened (docs/archive-records.md).
import type { APIRoute, GetStaticPaths } from "astro";
import { manuscriptRecordIds, recordBundle } from "../../../lib/records";

export const getStaticPaths: GetStaticPaths = () => manuscriptRecordIds().map((id) => ({ params: { id } }));
export const GET: APIRoute = ({ params }) =>
  new Response(JSON.stringify(recordBundle(String(params.id))), { headers: { "Content-Type": "application/json" } });
