/* Ministry Analysis Terminal - ESP32-WROOM / ILI9341 320 x 240.
 * Blue GPIO25: previous. White GPIO26: next. Red GPIO32: finish session.
 * HTTPS runs on a worker task. Only loop() touches the TFT and buttons.
 */
#include <Arduino.h>
#include <SPI.h>
#include <WiFi.h>
#include <HTTPClient.h>
#include <NetworkClientSecure.h>
#include <ArduinoJson.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ILI9341.h>
#include <time.h>
#include "secrets.h"
#include "certificates.h"
#include "demo_data.h"
#include "navigation.h"

constexpr uint8_t SCREEN_ROTATION = 3; // Landscape, rotated 180 degrees from rotation 1.
constexpr uint16_t BG=0x0841, PANEL=0x1926, MUTED=0xADDA, BLUE=0x4CDF, ORANGE=0xFDAC, WHITE=0xFFFF;
constexpr uint8_t MAX_ROWS=100;
struct Row { char id[16]; char name[64]; int32_t score; };
struct View {
  bool demo;
  char version[40];
  char name[64];
  int32_t score, rank, played, won;
  char teamId[16];
  uint8_t rowCount;
  Row rows[MAX_ROWS];
  char status[48];
};
struct Command { char version[40]; };
View shown;
QueueHandle_t views, resets, acknowledgements;
Adafruit_ILI9341 tft(&SPI, 21, 33, 22);
uint8_t page=0;
const uint8_t pins[]={25,26,32};
bool lastRaw[]={HIGH,HIGH,HIGH}, stable[]={HIGH,HIGH,HIGH};
uint32_t changedAt[]={0,0,0};
bool resetting=false;
char resetVersion[40]="";

void copyText(char* target, size_t capacity, const char* source) {
  snprintf(target, capacity, "%s", source ? source : "Unavailable");
  for (size_t i=0; target[i]; ++i) if ((uint8_t)target[i]<32 || (uint8_t)target[i]>126) target[i]='?';
}
void loadDemo(View& view) {
  memset(&view,0,sizeof(view)); view.demo=true;
  copyText(view.name,sizeof(view.name),Demo::team.name);
  snprintf(view.teamId,sizeof(view.teamId),"%u",Demo::team.team_id);
  view.score=Demo::team.score;view.rank=Demo::team.rank;view.played=Demo::team.games_played;view.won=Demo::team.games_won;
  view.rowCount=Demo::rowCount;
  for(uint8_t i=0;i<view.rowCount;++i) {
    snprintf(view.rows[i].id,sizeof(view.rows[i].id),"%u",Demo::leaderboard[i].id);
    copyText(view.rows[i].name,sizeof(view.rows[i].name),Demo::leaderboard[i].name);
    view.rows[i].score=Demo::leaderboard[i].score;
  }
  copyText(view.status,sizeof(view.status),"Ready / submit player ID");
}
uint8_t pageCount(){return 2+(shown.rowCount+2)/3;}
String numeric(int32_t n){return n<0 ? String("N/A") : String(n);}
void text(int x,int y,const String& value,uint8_t size=1,uint16_t colour=WHITE,uint8_t maxChars=50) {
  String display=value;
  if(display.length()>maxChars) display=display.substring(0,maxChars-3)+"...";
  tft.setCursor(x,y);tft.setTextSize(size);tft.setTextColor(colour);tft.print(display);
}
void rightText(int right,int y,const String& value,uint8_t size,uint16_t colour=WHITE){text(right-value.length()*6*size,y,value,size,colour);}
void render() {
  tft.fillScreen(BG);tft.fillRect(0,0,320,24,PANEL);
  text(10,8,"CLASSIFIED INFORMATION",1,MUTED);
  rightText(309,8,shown.demo ? "DEMO" : "TEAM",1,shown.demo?ORANGE:BLUE);
  if(page==0) {
    text(10,36,shown.name,2,BLUE,25);text(10,87,"SCORE",1,MUTED);
    String score=numeric(shown.score);rightText(308,69,score,score.length()>7?3:4);
    tft.drawFastHLine(10,116,298,PANEL);
    const char* labels[]={"RANK","PLAYED","WON"};
    String vals[]={shown.rank<0?"N/A":"#"+String(shown.rank),numeric(shown.played),numeric(shown.won)};
    for(int i=0;i<3;++i){int x=10+i*101;text(x,133,labels[i],1,MUTED);text(x,152,vals[i],vals[i].length()>5?1:2,ORANGE,12);}
  } else if(page==1) {
    text(10,36,"Team record",2,BLUE);
    bool known=shown.played>0 && shown.won>=0 && shown.won<=shown.played;
    int percent=known ? (int)round(100.0*shown.won/shown.played) : 0;
    text(10,69,known?String(percent)+"%":"N/A",4,BLUE);text(136,91,"WIN RATE",1,MUTED);
    tft.fillRect(10,123,298,18,PANEL);if(known)tft.fillRect(10,123,298*percent/100,18,BLUE);
    text(10,153,numeric(shown.won)+" won",2);rightText(308,153,numeric(shown.played)+" played",1);
    text(10,185,shown.played==0?"No games played yet":known?"Wins / games played":"Win rate unavailable",1,MUTED);
  } else {
    text(10,36,"League standings",2,BLUE);text(10,63,"TEAM",1,MUTED);rightText(308,63,"SCORE",1,MUTED);
    tft.drawFastHLine(10,76,298,PANEL);
    int32_t largest=0;for(int i=0;i<shown.rowCount;++i)largest=max(largest,shown.rows[i].score);
    int start=(page-2)*3;
    for(int j=0;j<3 && start+j<shown.rowCount;++j){
      const Row& row=shown.rows[start+j];int y=86+j*39;
      bool own=strcmp(row.id,shown.teamId)==0;uint16_t colour=own?ORANGE:WHITE;
      text(10,y,(own?String("> "):String(""))+row.name,1,colour,31);
      rightText(308,y,numeric(row.score),1,colour);
      tft.fillRect(10,y+19,298,5,PANEL);
      if(largest>0 && row.score>0)tft.fillRect(10,y+19,(int)(298.0*row.score/largest),5,own?ORANGE:BLUE);
    }
  }
  text(10,204,shown.status,1,MUTED,50);
  tft.fillRect(0,218,320,22,PANEL);
  text(10,226,shown.demo?"DEMO / FICTIONAL":"GAME API",1,shown.demo?ORANGE:MUTED);
  rightText(309,226,String(page+1)+"/"+String(pageCount()),1,MUTED);
}
int32_t readNumber(JsonVariantConst value) {
  if(value.isNull() || !value.is<int64_t>())return -1;
  int64_t n=value.as<int64_t>();return n>=0 && n<=INT32_MAX ? (int32_t)n : -1;
}
int request(const char* path,const char* method,const String& payload,String& output) {
  NetworkClientSecure client;client.setCACert(gtsRootR4);client.setHandshakeTimeout(8);
  HTTPClient http;http.setConnectTimeout(5000);http.setTimeout(12000);
  if(!http.begin(client,String(API_URL)+path))return -1;
  http.addHeader("Authorization",String("Bearer ")+DEVICE_KEY);
  http.addHeader("Accept","application/json");
  int code;
  if(strcmp(method,"POST")==0){http.addHeader("Content-Type","application/json");code=http.POST(payload);}
  else code=http.GET();
  if(code>0 && http.getSize()<=65536)output=http.getString();
  http.end();return code;
}
String commandBody(const Command& cmd){JsonDocument doc;doc["version"]=cmd.version;String body;serializeJson(doc,body);return body;}
void publish(View& view,const char* status){copyText(view.status,sizeof(view.status),status);xQueueOverwrite(views,&view);}
void networkTask(void*) {
  static View view;loadDemo(view);
  uint32_t nextPoll=0,lastWifi=0;char acked[40]="";Command pendingReset={};bool hasReset=false;
  WiFi.mode(WIFI_STA);WiFi.setAutoReconnect(true);WiFi.begin(WIFI_SSID,WIFI_PASSWORD);
  configTime(0,0,"pool.ntp.org","time.nist.gov");
  for(;;) {
    Command cmd;
    if(xQueueReceive(resets,&cmd,0)==pdTRUE){pendingReset=cmd;hasReset=true;nextPoll=0;}
    if(WiFi.status()!=WL_CONNECTED){
      publish(view,"Wi-Fi disconnected / retrying");
      if(millis()-lastWifi>15000){WiFi.disconnect();WiFi.begin(WIFI_SSID,WIFI_PASSWORD);lastWifi=millis();}
      vTaskDelay(pdMS_TO_TICKS(1000));continue;
    }
    if(time(nullptr)<1700000000){publish(view,"Syncing clock for secure HTTPS");vTaskDelay(pdMS_TO_TICKS(1000));continue;}
    if((int32_t)(millis()-nextPoll)<0){vTaskDelay(pdMS_TO_TICKS(40));continue;}
    String output;
    if(hasReset){
      int code=request("/api/device/reset","POST",commandBody(pendingReset),output);
      JsonDocument doc;
      if(code==200 && !deserializeJson(doc,output) && doc["reset"].is<bool>()){
        hasReset=false;loadDemo(view);acked[0]=0;publish(view,"Ready / submit player ID");
      }else{publish(view,"Reset pending / reconnecting");nextPoll=millis()+(code==429?60000:5000);continue;}
    }
    if(xQueueReceive(acknowledgements,&cmd,0)==pdTRUE && strcmp(cmd.version,acked)!=0){
      output="";int code=request("/api/device/ack","POST",commandBody(cmd),output);JsonDocument doc;
      if(code==200 && !deserializeJson(doc,output) && doc["acknowledged"]==true)copyText(acked,sizeof(acked),cmd.version);
      if(code==429){nextPoll=millis()+60000;continue;}
    }
    output="";int code=request("/api/device","GET","",output);
    nextPoll=millis()+(code==429?60000:3000);
    if(code!=200){publish(view,code==429?"Rate limit / waiting one minute":"Connection lost / retrying");continue;}
    JsonDocument doc;
    if(output.length()>65536 || deserializeJson(doc,output)){publish(view,"Invalid response / retrying");continue;}
    if(!doc["selection"].isNull() && !doc["snapshot"].is<JsonObject>()){publish(view,"Incomplete response / retrying");continue;}
    if(!doc["selection"].is<JsonObject>()) {loadDemo(view);acked[0]=0;publish(view,"Ready / submit player ID");continue;}
    JsonObjectConst selection=doc["selection"], data=doc["snapshot"];
    const char* id=selection["version"];const char* name=data["name"];const char* team=data["teamId"];
    if(!id || strlen(id)!=36 || !name || !team){publish(view,"Invalid team data / retrying");continue;}
    view.demo=false;copyText(view.version,sizeof(view.version),id);copyText(view.name,sizeof(view.name),name);copyText(view.teamId,sizeof(view.teamId),team);
    view.score=readNumber(data["score"]);view.rank=readNumber(data["rank"]);view.played=readNumber(data["gamesPlayed"]);view.won=readNumber(data["gamesWon"]);
    view.rowCount=0;
    for(JsonObjectConst row:data["leaderboard"].as<JsonArrayConst>()){
      if(view.rowCount>=MAX_ROWS)break;
      Row& target=view.rows[view.rowCount++];copyText(target.id,sizeof(target.id),row["id"]);copyText(target.name,sizeof(target.name),row["name"]);target.score=readNumber(row["score"]);
    }
    bool stale=false;for(JsonObjectConst source:data["sources"].as<JsonArrayConst>())if(source["ok"]==false)stale=true;
    publish(view,stale?"Some data unavailable / cached":"Connected / Reset when finished");
  }
}
void setup(){
  Serial.begin(115200);for(int i=0;i<3;++i){pinMode(pins[i],INPUT_PULLUP);lastRaw[i]=stable[i]=digitalRead(pins[i]);}
  SPI.begin(18,-1,23,33);tft.begin(10000000);tft.setRotation(SCREEN_ROTATION);tft.setTextWrap(false);
  loadDemo(shown);copyText(shown.status,sizeof(shown.status),"Connecting to hotspot...");render();
  views=xQueueCreate(1,sizeof(View));resets=xQueueCreate(1,sizeof(Command));acknowledgements=xQueueCreate(1,sizeof(Command));
  if(!views || !resets || !acknowledgements || xTaskCreate(networkTask,"terminal-network",16384,nullptr,1,nullptr)!=pdPASS){copyText(shown.status,sizeof(shown.status),"Network task unavailable");render();while(true)delay(1000);}
  Serial.println("Analysis Terminal ready. Network credentials are not logged.");
}
void loop(){
  static View incoming;
  if(xQueueReceive(views,&incoming,0)==pdTRUE){
    // Ignore old in-flight data while a Reset is being processed.
    if(!resetting || incoming.demo || strcmp(incoming.version,resetVersion)!=0){
      bool changed=memcmp(&incoming,&shown,sizeof(View))!=0;
      bool newSession=strcmp(incoming.version,shown.version)!=0 || incoming.demo!=shown.demo;
      shown=incoming;if(newSession)page=0;if(page>=pageCount())page=0;
      if(incoming.demo || strcmp(incoming.version,resetVersion)!=0)resetting=false;
      if(changed)render();
      if(!shown.demo){Command cmd={};copyText(cmd.version,sizeof(cmd.version),shown.version);xQueueOverwrite(acknowledgements,&cmd);}
    }
  }
  uint32_t now=millis();bool pressed[3]={};
  for(int i=0;i<3;++i){bool raw=digitalRead(pins[i]);if(raw!=lastRaw[i]){lastRaw[i]=raw;changedAt[i]=now;}if(raw!=stable[i] && now-changedAt[i]>=30){stable[i]=raw;pressed[i]=raw==LOW;}}
  if(pressed[2]){
    if(shown.demo){page=0;render();}
    else if(!resetting){Command cmd={};copyText(cmd.version,sizeof(cmd.version),shown.version);copyText(resetVersion,sizeof(resetVersion),shown.version);resetting=true;copyText(shown.status,sizeof(shown.status),"Resetting session...");render();xQueueOverwrite(resets,&cmd);}
  } else {uint8_t next=navigatePage(page,pageCount(),pressed[0],pressed[1],false);if(next!=page){page=next;render();}}
  delay(1);
}
