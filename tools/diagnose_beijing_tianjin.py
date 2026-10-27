"""Temporary diagnostic for the public MICHELIN restaurant index.
Collect schema and facet counts; no content is published without validation.
"""
import json,urllib.parse,urllib.request
APP='8NVHRD7ONV'
KEY='3222e669cf890dc73fa5f38241117ba5'
base='https://8nvhrd7onv-dsn.algolia.net/1/indexes/*/queries'
def call(params):
    url=base+'?'+urllib.parse.urlencode({'x-algolia-api-key':KEY,'x-algolia-application-id':APP})
    payload=json.dumps({'requests':[{'indexName':'prod-restaurants-en','params':urllib.parse.urlencode(params,doseq=False)}]}).encode()
    req=urllib.request.Request(url,payload,{'Content-Type':'application/json','Origin':'https://guide.michelin.com','User-Agent':'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=45) as r: return json.load(r)['results'][0]
for case, filters in [('both', ['city.slug:beijing','city.slug:tianjin']),('beijing',['city.slug:beijing']),('tianjin',['city.slug:tianjin'])]:
    try:
        p={'query':'','filters':'status:Published','facetFilters':json.dumps([filters]),'page':0,'hitsPerPage':3,'facets':json.dumps(['city.slug','distinction.slug'])}
        x=call(p)
        print(case,'N=',x.get('nbHits'),'pages=',x.get('nbPages'),'facets=',x.get('facets'))
        for h in x.get('hits',[])[:2]: print(json.dumps(h,ensure_ascii=False,default=str)[:8000])
    except Exception as e: print('ERROR',case,repr(e))
