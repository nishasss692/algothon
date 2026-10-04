// Seed script — generates demo data for the "Demo: Product Launch" project.
// Run: npm run seed
// Requires: SUPABASE_SERVICE_ROLE_KEY in .env, NEXT_PUBLIC_SUPABASE_URL + NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local

import { createClient } from '@supabase/supabase-js';
import { format, addDays, parse } from 'date-fns';
import { randomUUID } from 'crypto';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY;

if (!url || !anonKey || !serviceKey) {
  console.error('Missing required env vars: SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL, ANON/PUBLISHABLE_KEY, and SERVICE_ROLE/SECRET_KEY');
  process.exit(1);
}

const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

function clientFor(email: string, password: string) {
  const c = createClient(url!, anonKey!, { auth: { autoRefreshToken: false, persistSession: false } });
  return { client: c, signIn: () => c.auth.signInWithPassword({ email, password }) };
}

const today = format(new Date(), 'yyyy-MM-dd');
function dueDate(offset: number) {
  return format(addDays(parse(today, 'yyyy-MM-dd', new Date()), offset), 'yyyy-MM-dd');
}

async function getOrCreateUser(email: string, password: string, name: string) {
  const { data: list } = await admin.auth.admin.listUsers();
  const existing = list?.users.find(u => u.email === email);
  if (existing) {
    console.log(`  User ${email} already exists. Confirming email...`);
    await admin.auth.admin.updateUserById(existing.id, { email_confirm: true });
    return existing;
  }
  const { data, error } = await admin.auth.admin.createUser({
    email, password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error) throw new Error(`Create user ${email}: ${error.message}`);
  console.log(`  Created user ${email}`);
  return data.user;
}

async function main() {
  // Step 1: Create users
  console.log('Step 1: Creating users...');
  const aaravUser = await getOrCreateUser('aarav@demo.com', 'demo1234', 'Aarav');
  const priyaUser = await getOrCreateUser('priya@demo.com', 'demo1234', 'Priya');
  const rohanUser = await getOrCreateUser('rohan@demo.com', 'demo1234', 'Rohan');

  // Step 2: Sign in each user
  console.log('Step 2: Signing in users...');
  const aaravC = clientFor('aarav@demo.com', 'demo1234');
  const priyaC = clientFor('priya@demo.com', 'demo1234');
  const rohanC = clientFor('rohan@demo.com', 'demo1234');

  await aaravC.signIn();
  await priyaC.signIn();
  await rohanC.signIn();

  // Set profile colors
  console.log('Step 2b: Setting profile colors...');
  await aaravC.client.from('profiles').update({ color: '#6366f1' }).eq('id', aaravUser.id);
  await priyaC.client.from('profiles').update({ color: '#f43f5e' }).eq('id', priyaUser.id);
  await rohanC.client.from('profiles').update({ color: '#10b981' }).eq('id', rohanUser.id);

  // Step 3: Reset demo project
  console.log('Step 3: Removing old demo project...');
  await admin.from('projects').delete().eq('name', 'Demo: Product Launch');

  // Step 4: Create project as Aarav, join as Priya and Rohan
  console.log('Step 4: Creating project...');
  const { data: projectRow, error: projectErr } = await aaravC.client
    .from('projects')
    .insert({ name: 'Demo: Product Launch' })
    .select('id, join_code')
    .single();
  if (projectErr) throw new Error(`Create project: ${projectErr.message}`);
  const projectId = projectRow.id as string;
  const joinCode = projectRow.join_code as string;
  console.log(`  Project created: ${projectId}, join code: ${joinCode}`);

  const { error: joinP } = await priyaC.client.rpc('join_project', { code: joinCode });
  if (joinP) throw new Error(`Priya join: ${joinP.message}`);
  const { error: joinR } = await rohanC.client.rpc('join_project', { code: joinCode });
  if (joinR) throw new Error(`Rohan join: ${joinR.message}`);
  console.log('  Priya and Rohan joined.');

  // Step 5: Create tasks
  console.log('Step 5: Creating tasks...');
  const taskDefs: {
    title: string; status: string; assigneeEmail: string | null;
    dueOffset: number; creatorClient: ReturnType<typeof clientFor>; creatorLabel: string;
  }[] = [
    { title: 'Write launch announcement',    status: 'todo',        assigneeEmail: 'priya@demo.com', dueOffset: 3,  creatorClient: aaravC, creatorLabel: 'Aarav' },
    { title: 'Set up analytics dashboard',   status: 'todo',        assigneeEmail: 'rohan@demo.com', dueOffset: 1,  creatorClient: rohanC, creatorLabel: 'Rohan' },
    { title: 'Draft pricing page copy',      status: 'todo',        assigneeEmail: 'priya@demo.com', dueOffset: -2, creatorClient: priyaC, creatorLabel: 'Priya' },
    { title: 'Prepare support FAQ',          status: 'todo',        assigneeEmail: null,             dueOffset: 2,  creatorClient: aaravC, creatorLabel: 'Aarav' },
    { title: 'Build onboarding flow',        status: 'in_progress', assigneeEmail: 'aarav@demo.com', dueOffset: 2,  creatorClient: aaravC, creatorLabel: 'Aarav' },
    { title: 'Design email templates',       status: 'in_progress', assigneeEmail: 'priya@demo.com', dueOffset: 5,  creatorClient: priyaC, creatorLabel: 'Priya' },
    { title: 'Fix signup validation bug',    status: 'in_progress', assigneeEmail: 'rohan@demo.com', dueOffset: -1, creatorClient: rohanC, creatorLabel: 'Rohan' },
    { title: 'Integrate payment webhooks',   status: 'in_progress', assigneeEmail: 'aarav@demo.com', dueOffset: -3, creatorClient: aaravC, creatorLabel: 'Aarav' },
    { title: 'Landing page QA',             status: 'review',      assigneeEmail: 'rohan@demo.com', dueOffset: 1,  creatorClient: rohanC, creatorLabel: 'Rohan' },
    { title: 'Legal review of terms',       status: 'review',      assigneeEmail: 'aarav@demo.com', dueOffset: 4,  creatorClient: aaravC, creatorLabel: 'Aarav' },
    { title: 'Accessibility audit',          status: 'review',      assigneeEmail: 'priya@demo.com', dueOffset: 6,  creatorClient: priyaC, creatorLabel: 'Priya' },
    { title: 'Set up CI pipeline',           status: 'done',        assigneeEmail: 'aarav@demo.com', dueOffset: -5, creatorClient: aaravC, creatorLabel: 'Aarav' },
    { title: 'Choose brand colors',          status: 'done',        assigneeEmail: 'priya@demo.com', dueOffset: -6, creatorClient: priyaC, creatorLabel: 'Priya' },
    { title: 'Create project repo',          status: 'done',        assigneeEmail: 'rohan@demo.com', dueOffset: -8, creatorClient: rohanC, creatorLabel: 'Rohan' },
    { title: 'Domain and hosting setup',     status: 'done',        assigneeEmail: 'aarav@demo.com', dueOffset: -4, creatorClient: aaravC, creatorLabel: 'Aarav' },
  ];

  const emailToId: Record<string, string> = {
    'aarav@demo.com': aaravUser.id,
    'priya@demo.com': priyaUser.id,
    'rohan@demo.com': rohanUser.id,
  };

  // Group by status to assign positions
  const statusGroups: Record<string, typeof taskDefs> = {};
  for (const t of taskDefs) {
    if (!statusGroups[t.status]) statusGroups[t.status] = [];
    statusGroups[t.status].push(t);
  }

  const taskIds: Record<string, string> = {};

  for (const status of ['todo', 'in_progress', 'review', 'done']) {
    const group = statusGroups[status] || [];
    let position = 1000;
    for (const t of group) {
      const assigneeId = t.assigneeEmail ? emailToId[t.assigneeEmail] : null;
      // Landing page QA starts as todo, then moved to review
      const insertStatus = t.title === 'Landing page QA' ? 'todo' : t.status;
      const { data, error } = await t.creatorClient.client
        .from('tasks')
        .insert({
          project_id: projectId,
          title: t.title,
          status: insertStatus,
          assignee_id: assigneeId,
          due_date: dueDate(t.dueOffset),
          position,
        })
        .select('id')
        .single();
      if (error) throw new Error(`Insert task "${t.title}": ${error.message}`);
      taskIds[t.title] = data.id as string;
      console.log(`  Task created: ${t.title} (${insertStatus}) by ${t.creatorLabel}`);
      position += 1000;
    }
  }

  // Step 6: Comments
  console.log('Step 6: Adding comments...');
  await addComment(aaravC, taskIds['Integrate payment webhooks'], projectId, 'Stripe test keys are in the shared vault.');
  await addComment(rohanC, taskIds['Integrate payment webhooks'], projectId, 'Webhook signature check is failing in staging, looking into it.');
  await addComment(priyaC, taskIds['Draft pricing page copy'], projectId, 'Need the final plan names before I can finish this.');
  await addComment(aaravC, taskIds['Build onboarding flow'], projectId, 'First pass of the stepper is done.');
  await addComment(priyaC, taskIds['Build onboarding flow'], projectId, 'Can we add a skip option on step 2?');

  // Step 7: Timeline events via real updates
  console.log('Step 7: Creating timeline events...');

  // Rohan moves "Landing page QA" from todo to review
  const { error: e7a } = await rohanC.client
    .from('tasks')
    .update({ status: 'review' })
    .eq('id', taskIds['Landing page QA']);
  if (e7a) throw new Error(`Move QA to review: ${e7a.message}`);

  // Aarav reassigns "Prepare support FAQ" to Rohan then back to nobody
  await aaravC.client.from('tasks').update({ assignee_id: rohanUser.id }).eq('id', taskIds['Prepare support FAQ']);
  await aaravC.client.from('tasks').update({ assignee_id: null }).eq('id', taskIds['Prepare support FAQ']);

  // Priya changes due date of "Design email templates" from +3 to +5
  await priyaC.client.from('tasks').update({ due_date: dueDate(5) }).eq('id', taskIds['Design email templates']);

  // Step 8: File upload for "Landing page QA"
  console.log('Step 8: Uploading file...');
  const { data: buckets } = await admin.storage.listBuckets();
  if (!buckets?.some(b => b.name === 'attachments')) {
    await admin.storage.createBucket('attachments', { public: false });
    console.log('  Created private "attachments" bucket.');
  }

  const fileContent = Buffer.from('## Launch Checklist\n- [ ] Homepage live\n- [ ] Analytics tracking\n- [ ] Email flows tested\n- [ ] Support docs published\n');
  const fileUuid = randomUUID();
  const filePath = `${projectId}/${taskIds['Landing page QA']}/${fileUuid}-launch-checklist.txt`;

  const { error: uploadErr } = await rohanC.client.storage
    .from('attachments')
    .upload(filePath, fileContent, { contentType: 'text/plain' });
  if (uploadErr) throw new Error(`Upload file: ${uploadErr.message}`);

  const { error: attachErr } = await rohanC.client.from('attachments').insert({
    task_id: taskIds['Landing page QA'],
    project_id: projectId,
    path: filePath,
    file_name: 'launch-checklist.txt',
    size: fileContent.length,
  });
  if (attachErr) throw new Error(`Insert attachment: ${attachErr.message}`);
  console.log('  File uploaded and attachment row inserted.');

  // Print summary
  console.log('\n=== Seed complete ===');
  console.log(`Project: "Demo: Product Launch"`);
  console.log(`Join code: ${joinCode}`);
  console.log('Logins:');
  console.log('  aarav@demo.com / demo1234');
  console.log('  priya@demo.com / demo1234');
  console.log('  rohan@demo.com / demo1234');
}

async function addComment(c: ReturnType<typeof clientFor>, taskId: string, projectId: string, body: string) {
  const { error } = await c.client.from('comments').insert({ task_id: taskId, project_id: projectId, body });
  if (error) throw new Error(`Insert comment: ${error.message}`);
}

main().catch(err => { console.error(err); process.exit(1); });
