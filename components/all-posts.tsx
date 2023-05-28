import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card"
import Post from "@/interfaces/post"
import Image from "next/image"
import Link from "next/link"
type Props = { posts: Post[] }

const AllPosts = ({ posts }: Props) => {
  return (
    <section className="container flex flex-col items-center gap-4 space-y-12 text-left">
      {posts && posts.map((post) => (
        <Card key={post.name}>
          <Link href={post.slug} id={post.slug}>
            <CardContent>
              <Image
                src={post.ba_imageUrl}
                alt={post.name}
                width={post.w}
                height={post.h}
              >
              </Image>
            </CardContent>
            <CardHeader>
              <CardTitle>{post.name}</CardTitle>
              <CardDescription className="line-clamp-1">
                {post.description}
              </CardDescription>
            </CardHeader>
          </Link>
        </Card>
      ))}
    </section>
  )
}

export default AllPosts
