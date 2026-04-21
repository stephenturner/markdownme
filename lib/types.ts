export interface PageData {
  markdown: string
  title: string
  author: string
  date: string
  url: string
}

export interface HeadingNode {
  text: string
  level: number
  children: HeadingNode[]
}
