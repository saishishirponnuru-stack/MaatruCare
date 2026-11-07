"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import AppShell from "@/components/layout/AppShell";
import { Badge, Button, Message, PageHeading, Panel } from "@/components/ui/ProductUI";
import { useMaatruCareDemo, type DemoTimelineEvent } from "@/context/MaatruCareDemoContext";
import { useAuth } from "@/context/AuthContext";
import { api, type ApiTimelineEvent } from "@/lib/api";
import { displayTimestamp } from "@/lib/coordination";
const links: Record<string,string> = {Task:"/tasks",CareHandoff:"/handoffs",Caregiver:"/care-circle",CaregiverInvitation:"/care-circle",Permission:"/consent",AIDraft:"/ai-assist",Patient:"/profile"};
const categories = ["All","Tasks","Handoffs","Care Circle","Sharing changes","Appointments"];
function eventRecord(item: ApiTimelineEvent): DemoTimelineEvent {
  return {id:String(item.id),title:item.title,description:item.description??"",time:item.created_at,eventDate:item.event_date,eventType:item.event_type,source:item.source??undefined,actor:item.actor_name??undefined,timestamp:item.created_at,resourceType:item.resource_type??undefined,resourceId:item.resource_id??undefined,simulated:item.simulated};
}
export default function TimelinePage() {
  const {account} = useAuth();
  const {timeline,timelineLoading,timelineError,refreshData} = useMaatruCareDemo();
  const [filter,setFilter] = useState("All");
  const [order,setOrder] = useState<"newest"|"oldest">("newest");
  const [records,setRecords] = useState<DemoTimelineEvent[]>([]);
  const [extra,setExtra] = useState<DemoTimelineEvent[]>([]);
  const [hasMore,setHasMore] = useState(true);
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [loadedKey,setLoadedKey] = useState("");
  const generation = useRef(0);
  const lock = useRef(false);
  const defaultView = filter === "All" && order === "newest";
  const selectionKey = `${filter}:${order}`;
  const identity = account?.patient_id && account.caregiver_id ? {patientId:account.patient_id,caregiverId:account.caregiver_id} : null;
  const visible = [...new Map((defaultView ? [...timeline,...extra] : loadedKey === selectionKey ? records : []).map((item)=>[item.id,item])).values()].sort((a,b)=>{
    const value = Date.parse(a.timestamp??a.eventDate)-Date.parse(b.timestamp??b.eventDate) || Number(a.id)-Number(b.id);
    return order === "oldest" ? value : -value;
  });
  const fetchFirst = useCallback(async () => {
    if (!account?.patient_id || !account.caregiver_id) return;
    const version = ++generation.current;
    setBusy(true);setError("");
    try {
      const result = await api.getTimeline({patientId:account.patient_id,caregiverId:account.caregiver_id},15,0,{order,category:filter});
      if (version !== generation.current) return;
      setRecords(result.map(eventRecord));setLoadedKey(`${filter}:${order}`);setHasMore(result.length === 15);
    } catch(cause) { if(version===generation.current)setError(cause instanceof Error?cause.message:"Activity could not be loaded."); }
    finally { if(version===generation.current)setBusy(false); }
  },[account,filter,order]);
  useEffect(()=>{
    if(defaultView)return;
    const timer=window.setTimeout(()=>void fetchFirst(),0);
    return()=>window.clearTimeout(timer);
  },[defaultView,fetchFirst]);
  function change(nextFilter:string,nextOrder:"newest"|"oldest") {
    ++generation.current;setFilter(nextFilter);setOrder(nextOrder);setExtra([]);setRecords([]);setLoadedKey("");setHasMore(true);setError("");setBusy(false);
  }
  async function more() {
    if(!identity||lock.current||busy)return;
    lock.current=true;setBusy(true);setError("");const version=generation.current;
    try {
      const result=await api.getTimeline(identity,15,visible.length,{order,category:filter});
      if(version!==generation.current)return;
      if(defaultView)setExtra((old)=>[...old,...result.map(eventRecord)]);else setRecords((old)=>[...old,...result.map(eventRecord)]);
      setHasMore(result.length===15);
    } catch(cause){if(version===generation.current)setError(cause instanceof Error?cause.message:"Earlier activity could not be loaded.");}
    finally{lock.current=false;if(version===generation.current)setBusy(false);}
  }
  const initialLoading=defaultView?timelineLoading:!error&&loadedKey!==selectionKey;
  const viewError=defaultView?timelineError||error:error;
  return <AppShell><PageHeading title="Your activity timeline" description="Follow the responsibilities, sharing choices and handoffs recorded by your care circle." action={<label className="text-sm"><span className="sr-only">Activity order</span><select aria-label="Activity order" className="mc-input" value={order} onChange={(event)=>change(filter,event.target.value as "newest"|"oldest")}><option value="newest">Newest first</option><option value="oldest">Oldest first</option></select></label>} />
    <div className="mc-tabs" aria-label="Activity filters">{categories.map((value)=><button key={value} type="button" aria-pressed={filter===value} onClick={()=>change(value,order)}>{value==="All"?"All activity":value}</button>)}</div>
    <Message error>{viewError}</Message>{viewError&&<Button variant="secondary" disabled={busy} onClick={()=>defaultView?void refreshData():void fetchFirst()}>Retry loading activity</Button>}
    <Panel title={filter==="All"?"Care Circle activity":filter} description={order==="newest"?"Newest at the top. Follow the line down to earlier activity.":"Follow the flow from earlier activity to later actions."}>
      {initialLoading?<p role="status" className="mc-caption">Loading activity...</p>:visible.length?<ol className="mc-action-timeline" aria-label={order==="newest"?"Activity from newest to oldest":"Activity from oldest to newest"}>{visible.map((item,index)=><li key={item.id} className="mc-action-timeline__event"><span aria-hidden="true" className="mc-action-timeline__node" />{order==="oldest"&&index<visible.length-1&&<ChevronDown aria-hidden="true" size={13} className="mc-action-timeline__direction" />}<div className="flex flex-wrap items-start justify-between gap-2"><h3 className="break-words text-base font-semibold">{item.title}</h3>{item.simulated&&<Badge>Simulated</Badge>}</div><p className="mc-caption mt-1">{item.actor&&<span>{item.actor} - </span>}<time dateTime={item.timestamp??item.eventDate}>{item.timestamp?displayTimestamp(item.timestamp):item.eventDate}</time></p>{item.description&&item.description!==item.title&&<p className="mc-caption mt-2 max-w-3xl break-words">{item.description}</p>}{item.resourceType&&links[item.resourceType]&&<Link href={links[item.resourceType]} className="mc-caption mt-3 inline-flex min-h-8 items-center text-[var(--mc-brand)] underline">{item.resourceType==="CareHandoff"?"Open handoffs":item.resourceType==="Task"?"Open tasks":item.resourceType==="Permission"?"Open sharing preferences":item.resourceType==="AIDraft"?"Open AI drafts":"Open related activity"}</Link>}</li>)}</ol>:<div className="py-5"><h3 className="font-semibold">No activity in this view yet</h3><p className="mc-caption mt-2">Saved actions will appear here. Change the filter to explore other activity.</p></div>}
      {!initialLoading&&hasMore&&(defaultView?timeline.length===15:visible.length>=15)&&<Button variant="secondary" className="mt-6" disabled={busy} onClick={()=>void more()}>{busy?"Loading...":order==="newest"?"Load earlier activity":"Load later activity"}</Button>}
    </Panel>
  </AppShell>;
}
