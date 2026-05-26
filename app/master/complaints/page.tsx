export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default function MasterComplaintsRedirect() {
  redirect('/master/tickets?category=complaint');
}
