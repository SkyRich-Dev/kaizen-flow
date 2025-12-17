import { Octokit } from '@octokit/rest';
import { readFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, relative } from 'path';

let connectionSettings = null;

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
  connectionSettings = data.items?.[0];
  return connectionSettings?.settings?.access_token || connectionSettings?.settings?.oauth?.credentials?.access_token;
}

function getAllFiles(dir, baseDir = dir, files = []) {
  const excludeDirs = ['node_modules', '.git', '__pycache__', '.venv', '.upm', '.cache', '.config', 'dist', '.pythonlibs', '.local', '.egg-info'];
  const items = readdirSync(dir);
  
  for (const item of items) {
    if (excludeDirs.some(ex => item.includes(ex))) continue;
    const fullPath = join(dir, item);
    const relativePath = relative(baseDir, fullPath);
    
    try {
      const stat = statSync(fullPath);
      if (stat.isDirectory()) {
        getAllFiles(fullPath, baseDir, files);
      } else if (stat.size < 1000000) { // Skip files > 1MB
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
  
  console.log('Pushing to:', owner + '/' + repo);
  
  // Get all files
  const files = getAllFiles('/home/runner/workspace');
  console.log('Found', files.length, 'files to push');
  
  // Create blobs for all files
  const tree = [];
  let count = 0;
  
  for (const file of files) {
    try {
      const content = readFileSync(file.fullPath);
      const { data: blob } = await octokit.git.createBlob({
        owner, repo,
        content: content.toString('base64'),
        encoding: 'base64'
      });
      tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
      count++;
      if (count % 20 === 0) console.log('Uploaded', count, '/', files.length);
    } catch (e) {
      console.log('Skip:', file.path);
    }
  }
  
  console.log('Creating tree...');
  const { data: newTree } = await octokit.git.createTree({ owner, repo, tree });
  
  console.log('Creating commit...');
  const { data: commit } = await octokit.git.createCommit({
    owner, repo,
    message: 'KaizenFlow - Complete project upload',
    tree: newTree.sha,
    parents: []
  });
  
  console.log('Updating main branch...');
  try {
    await octokit.git.updateRef({ owner, repo, ref: 'heads/main', sha: commit.sha, force: true });
  } catch (e) {
    await octokit.git.createRef({ owner, repo, ref: 'refs/heads/main', sha: commit.sha });
  }
  
  console.log('Done! Visit: https://github.com/' + owner + '/' + repo);
}

main().catch(e => console.error('Error:', e.message));
