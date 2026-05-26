export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default function MasterWebsiteSupportRequestsRedirect() {
  redirect('/master/tickets?category=website_support');
}
