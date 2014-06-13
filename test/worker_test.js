var sinon = require('sinon');
var chai = require('chai');
var expect = chai.expect;
chai.use(require('sinon-chai'));

var Worker = require('../worker.js');
var schema = require('../schema.js')
var _ = require('lodash');

describe("worker", function() {
  var work = null;
  var io = null;
  var context = null;
  var config = null;
  var job = null;
  var exitCode = null;

  var prepareWorker = function(done) {
    context = {
      comment: sinon.stub()
    };
    io = {
      on: sinon.stub().yields('123', { exitCode: exitCode }),
      removeListener: sinon.stub(),
      emit: sinon.stub()
    };
    Worker.init(config, job, sinon.stub(), function(err, res) {
      expect(context.comment).not.to.have.been.called;
      work = function() {
        res.listen(io, context);
        return io.emit.getCall(0).args[3];
      };
      if (done) done();
    })
  };

  beforeEach(function(done) {
    exitCode = 0;
    job = {
      project: { name: "strider-slack" },
      ref: { branch: "master" },
      _id: "123",
      trigger: { 
        type: "manual"
      }
    };
    process.env.strider_server_name = "http://example.com"
    config = {};
    _.each(schema, function(v,k) { config[k] = v.default });
    config.token = 'token';
    config.subdomain = 'subdomain';
    prepareWorker(done);
  });

  it("emits properly", function() {
    var out = work();
    expect(io.emit).to.have.been.calledWith('plugin.slack.fire', 'token', 'subdomain');
    expect(out.channel).to.eq('#general');
    expect(out.username).to.eq('strider-slack');
    expect(out.icon_url).to.eq('http://media.stridercd.com/img/logo.png');
    expect(out.text.length).to.be.greaterThan(10);
  });

  describe("test pass text", function() {
    beforeEach(function() {
      work();
    });

    describe("manual trigger", function() {
      it("does not link to a commit but shows branch", function() {
        expect(work().text).to.eq(':white_check_mark: (master) Tests are passing :: <http://example.com/strider-slack/job/123|logs>')
      });
    });

    describe("commit trigger", function() {
      var url = "https://github.com/xyz";
      var message = "my commit message";
      beforeEach(function() {
        job.ref.id = 'appears only on commit trigger';
        job.trigger.type = "commit";
        job.trigger.message = message+"\n\n";
        job.trigger.url = url;
        prepareWorker();
      });
      it("shows commit message as a link on a new line", function() {
        expect(work().text).to.eq(":white_check_mark: (master) Tests are passing :: <http://example.com/strider-slack/job/123|logs>\n<"+url+"|"+message+">")
      });
    });
  });
});
