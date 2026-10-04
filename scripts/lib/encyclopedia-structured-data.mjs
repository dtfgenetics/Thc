export function encyclopediaStructuredData(lesson,{site='https://dtfseeds.com'}={}){
  const base=String(site).replace(/\/$/,'');
  const slug=String(lesson?.id||'').toLowerCase();
  const url=`${base}/learn/encyclopedia/${slug}/`;
  const terms=(Array.isArray(lesson?.terms)?lesson.terms:Array.isArray(lesson?.termsToKnow)?lesson.termsToKnow:[])
    .map(item=>typeof item==='string'?item:item?.term)
    .filter(Boolean);
  return {
    '@context':'https://schema.org',
    '@graph':[
      {
        '@type':['Article','LearningResource'],
        '@id':url+'#article',
        mainEntityOfPage:url,
        url,
        headline:lesson?.title,
        name:lesson?.title,
        identifier:lesson?.id,
        description:lesson?.objective,
        inLanguage:'en-US',
        learningResourceType:'Encyclopedia article',
        educationalUse:'Reference',
        teaches:lesson?.objective,
        about:terms.map(name=>({'@type':'DefinedTerm',name})),
        isPartOf:{
          '@type':'CollectionPage',
          '@id':`${base}/learn/encyclopedia/#collection`,
          url:`${base}/learn/encyclopedia/`,
          name:'THC Cannabis Plant Science Encyclopedia'
        },
        publisher:{
          '@type':'Organization',
          name:'DTF Genetics',
          url:base
        }
      },
      {
        '@type':'BreadcrumbList',
        '@id':url+'#breadcrumbs',
        itemListElement:[
          {'@type':'ListItem',position:1,name:'Learning Center',item:`${base}/learn/`},
          {'@type':'ListItem',position:2,name:'Cannabis Plant Science Encyclopedia',item:`${base}/learn/encyclopedia/`},
          {'@type':'ListItem',position:3,name:lesson?.title,item:url}
        ]
      }
    ]
  };
}

export function encyclopediaStructuredDataHtml(lesson,options={}){
  const json=JSON.stringify(encyclopediaStructuredData(lesson,options)).replace(/</g,'\\u003c');
  return '<script type="application/ld+json">'+json+'</script>';
}
