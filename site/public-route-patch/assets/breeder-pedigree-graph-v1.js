(function(global){
  'use strict';
  const api={version:'dtf-breeder-graph-v1'};

  function clean(value){ return String(value ?? '').trim(); }
  function key(value){ return clean(value).toLocaleLowerCase(); }

  function graphElements(records){
    const nodes=new Map();
    const edges=[];
    for(const record of Array.isArray(records)?records:[]){
      const child=clean(record.child), a=clean(record.a), b=clean(record.b);
      for(const name of [a,b,child]){
        if(!name) continue;
        const id=key(name);
        if(!nodes.has(id)) nodes.set(id,{data:{id,label:name}});
      }
      if(child && a) edges.push({data:{id:`edge-${key(a)}-${key(child)}-${edges.length}`,source:key(a),target:key(child),role:'parent-a'}});
      if(child && b) edges.push({data:{id:`edge-${key(b)}-${key(child)}-${edges.length}`,source:key(b),target:key(child),role:'parent-b'}});
    }
    return [...nodes.values(),...edges];
  }

  function focusGraph(cy,focusName){
    cy.elements().removeClass('focus ancestor descendant dim');
    const focus=cy.getElementById(key(focusName));
    if(!focus || focus.empty()) return;
    const ancestors=focus.predecessors().nodes();
    const descendants=focus.successors().nodes();
    cy.elements().addClass('dim');
    focus.removeClass('dim').addClass('focus');
    ancestors.removeClass('dim').addClass('ancestor');
    descendants.removeClass('dim').addClass('descendant');
    focus.connectedEdges().removeClass('dim');
    ancestors.connectedEdges().removeClass('dim');
    descendants.connectedEdges().removeClass('dim');
    cy.animate({fit:{eles:focus.union(ancestors).union(descendants),padding:55},duration:220});
  }

  api.render=function(container,records,focusName=''){
    if(!container) return null;
    if(typeof global.cytoscape!=='function'){
      container.textContent='Interactive pedigree graph unavailable. The text relationship explorer remains available.';
      return null;
    }
    const elements=graphElements(records);
    if(!elements.length){
      container.textContent='Save breeding records to build the interactive pedigree graph.';
      return null;
    }
    if(container.__dtfCy){ container.__dtfCy.destroy(); container.__dtfCy=null; }
    container.textContent='';
    const cy=global.cytoscape({
      container,
      elements,
      layout:{name:'breadthfirst',directed:true,padding:30,spacingFactor:1.15},
      minZoom:.25,maxZoom:2.5,wheelSensitivity:.18,
      style:[
        {selector:'node',style:{'background-color':'#f4f7ee','border-color':'#245f3d','border-width':2,'label':'data(label)','font-size':12,'font-weight':700,'text-wrap':'wrap','text-max-width':130,'text-valign':'center','text-halign':'center','color':'#10271a','width':150,'height':54,'shape':'round-rectangle','padding':'6px'}},
        {selector:'edge',style:{'curve-style':'bezier','target-arrow-shape':'triangle','target-arrow-color':'#78927f','line-color':'#9fb4a5','width':2}},
        {selector:'.focus',style:{'background-color':'#245f3d','color':'#fff','border-width':4}},
        {selector:'.ancestor',style:{'background-color':'#edf4ff','border-color':'#486c94'}},
        {selector:'.descendant',style:{'background-color':'#fff4dd','border-color':'#9b6b22'}},
        {selector:'.dim',style:{'opacity':.18}}
      ]
    });
    cy.on('tap','node',event=>{
      const label=event.target.data('label');
      container.dispatchEvent(new CustomEvent('dtf:pedigree-focus',{bubbles:true,detail:{label}}));
    });
    if(clean(focusName)) focusGraph(cy,focusName);
    else cy.fit(undefined,35);
    container.__dtfCy=cy;
    return cy;
  };

  api.focus=function(container,name){
    const cy=container?.__dtfCy;
    if(cy) focusGraph(cy,name);
  };

  api.fit=function(container){
    const cy=container?.__dtfCy;
    if(cy) cy.animate({fit:{eles:cy.elements(),padding:35},duration:180});
  };

  global.THCBreederGraph=Object.freeze(api);
})(globalThis);
