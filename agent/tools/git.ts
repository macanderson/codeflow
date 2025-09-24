const WORKSPACE_DIR = '/home/user/workspace'

export async function gitClone(sbx: any, repoUrl: string) {
  await sbx.run(`rm -rf ${WORKSPACE_DIR} && mkdir -p ${WORKSPACE_DIR}`);
  const res = await sbx.run(`git clone ${repoUrl} ${WORKSPACE_DIR}`);
  return (res.stdout ?? "") + (res.stderr ?? "");
}
