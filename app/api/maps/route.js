import {env} from 'cloudflare:workers';
export function GET(){return Response.json({key:env.GOOGLE_MAPS_BROWSER_KEY||''});}
