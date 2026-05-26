export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default function MasterAwaitingClientResponseRedirect() {
  redirect('/master/tickets?status=awaiting_client');
}
