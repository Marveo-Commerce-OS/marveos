export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default function MasterPaymentIssuesRedirect() {
  redirect('/master/tickets?category=billing');
}
