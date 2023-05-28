import fs from 'fs'
import path from 'path'
import PostType from '@/interfaces/post'
export async function fetchPosts(): Promise<PostType[]> {

  const postsDirectory = path.join(process.cwd(), 'public', 'posts');
  const postFolders = fs.readdirSync(postsDirectory)

  const posts = postFolders.map( (postFolder) => {
    const fullPath = path.join(postsDirectory, postFolder, `${postFolder}.json`);
    const fileContents = fs.readFileSync(fullPath, 'utf8');

    const jsonContent = JSON.parse(fileContents);
    // return jsonContent
    return {
      name: jsonContent.name,
      description: jsonContent.description,
      b_imageUrl: jsonContent.b_imageUrl,
      a_imageUrl: jsonContent.a_imageUrl,
      ba_imageUrl: jsonContent.ba_imageUrl,
      w: jsonContent.w,
      h: jsonContent.h,
      slug: jsonContent.slug,
    }
  });

  return posts
}
