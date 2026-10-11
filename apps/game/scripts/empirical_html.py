"""Dependency-free parsing of published HTML; no network activity on import."""
from html.parser import HTMLParser
from dataclasses import dataclass, field

@dataclass
class Node:
    tag: str
    attrs: dict = field(default_factory=dict)
    children: list = field(default_factory=list)
    parent: object = None
    def text(self):
        if self.tag in {'script','style'}:return ''
        return ' '.join(' '.join(c.text() if isinstance(c,Node) else c for c in self.children).split())
    def find(self, predicate):
        found=[]
        for child in self.children:
            if isinstance(child,Node):
                if predicate(child): found.append(child)
                found.extend(child.find(predicate))
        return found

class Document(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=True)
        self.root=Node('document'); self.current=self.root
        self.feed(text)
    def handle_starttag(self, tag, attrs):
        node=Node(tag,dict(attrs),parent=self.current);self.current.children.append(node)
        if tag not in {'area','base','br','col','embed','hr','img','input','link','meta','param','source','track','wbr'}: self.current=node
    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag,attrs)
        if self.current.tag==tag:self.current=self.current.parent
    def handle_endtag(self, tag):
        node=self.current
        while node is not self.root:
            if node.tag==tag:self.current=node.parent;return
            node=node.parent
    def handle_data(self, data):
        self.current.children.append(data)
