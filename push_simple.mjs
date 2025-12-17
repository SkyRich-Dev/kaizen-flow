import { Octokit } from '@octokit/rest';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

async function getAccessToken() {
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;
  if (!xReplitToken) throw new Error('Token not found');
  const response = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    { headers: { 'Accept': 'application/json', 'X_REPLIT_TOKEN': xReplitToken } }
  );
  const data = await response.json();
  const cs = data.items?.[0];
  return cs?.settings?.access_token || cs?.settings?.oauth?.credentials?.access_token;
}

function getAllFiles(dir, baseDir = dir, files = []) {
  const excludeDirs = ['node_modules', '.git', '__pycache__', '.venv', '.upm', '.cache', '.config', 'dist', '.pythonlibs', '.local', 'kaizen-flow-project.zip'];
  const items = readdirSync(dir);
  for (const item of items) {
    if (excludeDirs.some(ex => item.includes(ex))) continue;
    if (item.startsWith('.') && item !== '.gitignore') continue;
    const fullPath = join(dir, item);
    const relativePath = relative(baseDir, fullPath);
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        getAllFiles(fullPath, baseDir, files);
      } else if (stat.size < 500000) {
        files.push({ path: relativePath, fullPath });
      }
    } catch (e) {}
  }
  return files;
}

async function main() {
  const accessToken = await getAccessToken();
  const octokit = new Octokit({ auth: accessToken });
  const { data: user } = await octokit.users.getAuthenticated();
  const owner = user.login;
  const repo = 'kaizen-flow';

  console.log('Owner:', owner);

  // First create an initial commit with README
  try {
    const readme = '# KaizenFlow\\n\\nRisk Assessment & Approval System with Django REST Framework backend and React frontend.';
    await octokit.repos.createOrUpdateFileContents({
      owner, repo,
      path: 'README.md',
      message: 'Initial commit',
      content: Buffer.from(readme).toString('base64')
    });
    console.log('Created README');
  } catch (e) {
    console.log('README exists or error:', e.message);
  }

  // Now get all files and upload them
  const files = getAllFiles('/home/runner/workspace');
  console.log('Uploading', files.length, 'files...');

  let uploaded = 0;
  let errors = 0;

  for (const file of files) {
    try {
      const content = readFileSync(file.fullPath);
      
      // Get existing file SHA if it exists
      let sha;
      try {
        const { data } = await octokit.repos.getContent({ owner, repo, path: file.path });
        sha = data.sha;
      } catch (e) {}

      await octokit.repos.createOrUpdateFileContents({
        owner, repo,
        path: file.path,
        message: 'Add ' + file.path,
        content: content.toString('base64'),
        sha
      });
      uploaded++;
      if (uploaded % 10 === 0) console.log('Uploaded:', uploaded);
    } catch (e) {
      errors++;
      if (e.status !== 422) console.log('Error:', file.path, e.message);
    }
  }

  console.log('\\nDone! Uploaded:', uploaded, 'Errors:', errors);
  console.log('Visit: https://github.com/' + owner + '/' + repo);
}

main().catch(e => console.error('Error:', e.message));
