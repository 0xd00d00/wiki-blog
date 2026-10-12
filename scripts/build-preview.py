"""Build local preview from published files; --demo adds 100 temporary articles."""
import argparse
import html
import json
import shutil
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlparse, unquote
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

SOURCE = Path(__file__).resolve().parents[1]
REMOTE = 'https://0xd00d00.github.io/wiki-blog/'
GROUPS = [
 ('AI와 에이전트', 'ai', ['에이전트 루프', '도구 호출', '메모리 설계', '프롬프트 구성', '검색 증강', '벡터 검색', '모델 평가', '안전장치', '멀티 에이전트', '작업 계획', '컨텍스트 관리', '응답 스트리밍', '로컬 모델', '추론 비용', '문서 임베딩', '검색 품질', '사용자 승인', '오류 복구', '지식 관리', 'AI 실험 기록']),
 ('웹과 사용자 경험', 'web', ['반응형 레이아웃', '접근성', '색상 테마', '검색 인터페이스', '터치 제스처', 'SVG 그래프', '화면 성능', '폰트 가독성', '컴포넌트 설계', '키보드 탐색', '레이아웃 그리드', '브라우저 저장소', '이미지 최적화', '모바일 메뉴', '사용성 테스트', '문서 탐색', '상태 관리', '클라이언트 검색', '디자인 시스템', '웹 실험 기록']),
 ('Rust와 시스템', 'rust', ['소유권', '트레이트', '비동기 런타임', '메모리 할당', '오류 처리', '스레드 안전', '파일 처리', '프로세스 관리', '채널 통신', '직렬화', '명령행 도구', '성능 측정', '빌드 설정', '테스트 전략', '네트워크 처리', '시스템 로그', '패키지 구성', '배포 바이너리', '리소스 제한', '시스템 실험 기록']),
 ('데이터와 검색', 'data', ['SQLite 저장소', '스키마 설계', '인덱스 구성', '전문 검색', '데이터 정규화', '태그 분류', '문서 링크', '그래프 모델', '유사도 측정', '클러스터링', '데이터 이관', '백업 복구', '쿼리 최적화', '캐시 전략', '트랜잭션', '검색 순위', '통계 집계', '데이터 검증', '지식 그래프', '데이터 실험 기록']),
 ('운영과 보안', 'ops', ['자동 배포', '권한 관리', '비밀 정보', '컨테이너', '모니터링', '장애 대응', '속도 제한', '보안 경계', '감사 로그', '의존성 관리', '릴리스 절차', '인증 설계', '네트워크 정책', '서비스 상태', '구성 관리', '샌드박스', '승인 흐름', '운영 문서', '복구 계획', '운영 실험 기록'])
]

class Links(HTMLParser):
    def __init__(self):
        super().__init__(); self.urls = []
    def handle_starttag(self, tag, attrs):
        if tag == 'a':
            self.urls.extend(v for k, v in attrs if k == 'href' and v)

def real_graph():
    docs = json.loads((SOURCE / 'wiki-index.json').read_text())
    nodes = [dict(id=d['slug'], title=d['title'], description=d['description'], tags=d['tags'], url=d['url'], group=0) for d in docs]
    lookup = {d['url'].strip('/'): d['slug'] for d in docs}
    edges = set()
    for d in docs:
        path = SOURCE / d['url'] / 'index.html'
        parser = Links(); parser.feed(path.read_text())
        for url in parser.urls:
            parsed = urlparse(url)
            if parsed.netloc and parsed.netloc != '0xd00d00.github.io': continue
            target = unquote(parsed.path).removeprefix('/wiki-blog/').strip('/')
            if target in lookup and lookup[target] != d['slug']:
                edges.add((d['slug'], lookup[target]))
    return dict(demo=False, groups=['문서'], nodes=nodes, links=[dict(source=a, target=b) for a,b in sorted(edges)])

def demo_graph():
    nodes = []
    for g, (name, tag, topics) in enumerate(GROUPS):
        for i, title in enumerate(topics):
            slug = f'demo-{g+1}-{i+1:02}'
            nodes.append(dict(id=slug, title=title, description=f'{name} 분야에서 {title}의 개념과 활용을 정리한 임시 테스트 문서입니다.', tags=[tag, '테스트'], url=f'wiki/{slug}/', group=g))
    edges = set()
    for g in range(5):
        # Last node of each group stays isolated, to exercise orphan handling.
        # Each topic has a hub, a ring of connected notes, and an orphan.
        hub = nodes[g*20]['id']
        for i in range(1,19):
            edges.add((hub, nodes[g*20+i]['id']))
            edges.add((nodes[g*20+i]['id'], nodes[g*20+(i%18)+1]['id']))
        for a,b in [(3,9),(6,15)]:
            edges.add((nodes[g*20+a]['id'],nodes[g*20+b]['id']))
        for i in (2,8,14):
            edges.add((nodes[g*20+i]['id'],nodes[((g+1)%5)*20+i]['id']))
    return dict(demo=True, groups=[g[0] for g in GROUPS], nodes=nodes, links=[dict(source=a,target=b) for a,b in sorted(edges)])

def build(output, demo, port, base_url=None):
    if output == SOURCE or SOURCE in output.parents: raise ValueError('미리보기 출력 폴더는 저장소 밖에 두세요.')
    output.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SOURCE, output, dirs_exist_ok=True, ignore=shutil.ignore_patterns('.git', 'scripts'))
    graph = demo_graph() if demo else real_graph()
    (output / 'graph-data.json').write_text(json.dumps(graph, ensure_ascii=False, indent=2))
    if demo:
        template = (SOURCE / 'wiki/zeroclaw-agent-architecture/index.html').read_text()
        # Temporary articles share the existing header, theme and search UI.
        start = template.index('<main class="wrap">'); end = template.index('</main>', start)
        index = [d for d in json.loads((SOURCE/'wiki-index.json').read_text()) if not d['slug'].startswith('demo-')]
        for n in graph['nodes']:
            title = html.escape(n['title']); group = GROUPS[n['group']][0]
            neighbours = sorted({l['target'] for l in graph['links'] if l['source']==n['id']} | {l['source'] for l in graph['links'] if l['target']==n['id']})
            by_id = {x['id']:x for x in graph['nodes']}
            links = ''.join(f'<li><a href="{REMOTE}{by_id[x]["url"]}">{html.escape(by_id[x]["title"])}</a></li>' for x in neighbours)
            body = f'''<main class="wrap"><div class="crumbbar"><a class="back" href="{REMOTE}map/">← 문서 지도</a></div><p class="hint2">임시 테스트 문서 · {group}</p><h1>{title}</h1><article class="body"><p>{html.escape(n['description'])}</p><h2>검토할 내용</h2><p>이 문서는 그래프 탐색과 모바일 레이아웃 검증을 위해 생성했습니다. 같은 주제의 문서를 모으고, 다른 분야와의 연결을 따라 탐색해 보세요.</p><h2>연결된 문서</h2><ul>{links}</ul></article></main>'''
            doc = template[:start] + body + template[end+7:]
            doc = doc.replace('<meta name="robots" content="index,follow,max-image-preview:large">','<meta name="robots" content="noindex,follow">')
            doc = doc.replace('ZeroClaw로 보는 AI 에이전트: 루프, 메모리, 그리고 안전장치', title)
            target = output / n['url']; target.mkdir(parents=True, exist_ok=True); (target/'index.html').write_text(doc)
            index.append(dict(slug=n['id'], title=n['title'], description=n['description'], tags=n['tags'], icon='📝', updated='2026-10-12',url=n['url']))
        (output/'wiki-index.json').write_text(json.dumps(index, ensure_ascii=False))
        p=output/'map/index.html'; s=p.read_text().replace('<span class="sub">1개 문서</span>','<span class="sub">임시 문서 100개 · 5개 그룹</span>')
        start=s.index('<section class="pane" id="pane-folders"'); end=s.index('</section>',start)
        tree=''
        for g,(name,tag,topics) in enumerate(GROUPS):
            items=''.join(f'<li><a href="{REMOTE}{n["url"]}">{html.escape(n["title"])}</a></li>' for n in graph['nodes'] if n['group']==g)
            tree+=f'<li class="dir"><details><summary>📁 {name} <span class="mn">20</span></summary><ul>{items}</ul></details></li>'
        s=s[:start]+f'<section class="pane" id="pane-folders" role="tabpanel" aria-labelledby="tab-folders"><p class="hint2">임시 문서 100개를 주제별 폴더 다섯 개로 나눴습니다.</p><ul class="tree">{tree}</ul></section>'+s[end+10:]
        p.write_text(s)
    for p in output.rglob('*'):
        if p.is_file() and p.suffix in ('.html','.xml','.json','.txt'):
            p.write_text(p.read_text().replace(REMOTE, base_url or f'http://localhost:{port}/'))
    print(f'미리보기 생성 완료: {len(graph["nodes"])}개 문서, {len(graph["links"])}개 연결',flush=True)
    return output

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--demo',action='store_true');parser.add_argument('--serve',action='store_true')
    parser.add_argument('--port',type=int,default=8765)
    parser.add_argument('--base-url',help='게시용 URL을 유지하려면 실제 사이트 주소를 지정하세요.')
    parser.add_argument('--output',type=Path,default=Path('/private/tmp/wiki-blog-preview/site'))
    args=parser.parse_args(); directory=build(args.output.resolve(),args.demo,args.port,args.base_url)
    if args.serve:
        class Handler(SimpleHTTPRequestHandler):
            def __init__(self,*a,**kw):super().__init__(*a,directory=str(directory),**kw)
            def end_headers(self):self.send_header('Cache-Control','no-store');super().end_headers()
        server=ThreadingHTTPServer(('127.0.0.1',args.port),Handler)
        print(f'테스트 지도: http://localhost:{args.port}/map/',flush=True)
        server.serve_forever()
